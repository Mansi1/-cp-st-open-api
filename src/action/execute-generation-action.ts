import {download} from "../function/download";
import {isUri} from "valid-url";
import {readFileSync} from "fs";
import * as YAML from "yaml";
import * as Ajv from 'ajv';
import {createComponentInterfaces} from "../function/create-component-interfaces";
import {copyResources} from "../function/copy-resources";
import {createServiceClasses} from "../function/create-service-classes";
import {join} from "path";
import {transpileToJs} from "../function/transpile-to-js";
import {createReactProvider} from "../function/create-react-provider";
import {createStaticServices} from "../function/create-static-services";
import {configuration} from "../function/config";
import {initServiceReference} from "../function/init-references";

const getSourceAsString = async (source: string): Promise<string> => {
    if (isUri(source)) {
        return await download(source);
    } else {
        return readFileSync(source).toString('utf-8');
    }
}

const validate = async (openApiSchema: object): Promise<boolean> => {
    const JSON_SCHEMA_3_0_x = JSON.parse(readFileSync(join(__dirname, '..', 'schema/open-api-3-0-x.json')).toString('utf-8'));
    const ajv = Ajv({schemaId: 'auto', allErrors: true});
    ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
    const valid = ajv.validate(JSON_SCHEMA_3_0_x, openApiSchema);
    if (!valid && configuration.isDebug()) console.log(ajv.errors);
    return valid
}

export type SpecMimeType = 'yaml' | 'json'

export const getSpecMimeType = (filePath: string): SpecMimeType => {

    const lowerCasedFilePath = filePath.toLowerCase();
    if (lowerCasedFilePath.indexOf('.yaml') > -1) {
        return 'yaml'
    }
    return 'json'
}

export const executeGenerationAction = async () => {
    const isDebug = configuration.isDebug();
    configuration.print();

    let openApiSpec;
    const openApiFileName = configuration.getOpenApiFile();

    // trasnform YAML to JSON
    if (getSpecMimeType(openApiFileName) === 'yaml') {

        openApiSpec = YAML.parse(readFileSync(openApiFileName, 'utf8'));

    } else {
        openApiSpec = JSON.parse(await getSourceAsString(openApiFileName));
    }

    try {
        const valid = await validate(openApiSpec);

        if (isDebug) {
            console.log('OpenApi JSON is valid :', valid);
        }
        if (valid || configuration.ignoreValidation()) {
            if (isDebug) {
                console.log('Initialize references');
            }

            createComponentInterfaces(openApiSpec.components);

            if (!configuration.isComponentOnly()) {
                initServiceReference(configuration.getFolderManager());
                createServiceClasses(openApiSpec);

                if (configuration.isCreateReactProvider()) {
                    createReactProvider();
                }

                if (configuration.isCreateStaticServices()) {
                    createStaticServices()
                }
                copyResources(configuration);
            }

            const language = configuration.getLanguage();
            if (language === 'js' || language === 'onlyJs') {
                transpileToJs()
            }

        } else {
            console.error("OpenApi Json not valid.")
            process.exit(1);
        }
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}
