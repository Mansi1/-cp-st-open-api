import {download} from "./download";
import {isUri} from "valid-url";
import {readFileSync} from "fs";

import * as Ajv from 'ajv';
import {initReference} from "./init-references";
import {createComponentInterfaces} from "./create-component-interfaces";
import {FolderManager} from "../classes/folder-manager";
import {copyResources} from "./copy-resources";
import {createServiceClasses} from "./create-service-classes";
import {IGenerateConfig} from "../interface/i-generate-config";
import {join} from "path";

const getSourceAsString = async (source: string): Promise<string> => {
    if (isUri(source)) {
        return await download(source);
    } else {
        return readFileSync(source).toString('utf-8');
    }
}

const validate = async (openApiSchema: object, verbose: boolean): Promise<boolean> => {
    const JSON_SCHEMA_3_0_x = JSON.parse(readFileSync(join(process.argv[1], '..', 'schema/open-api-3-0-x.json')).toString('utf-8'));
    const ajv = Ajv({schemaId: 'auto', allErrors: true});
    ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
    const valid = ajv.validate(JSON_SCHEMA_3_0_x, openApiSchema);
    if (!valid && verbose) console.log(ajv.errors);
    return valid
}

export const executeGenerationAction = async (source: string, output: string, opt: { useSpringtype: boolean; verbose: boolean; force: boolean }) => {
    if (opt.verbose) {
        console.log('inputs source, output, opt', source, output, opt)
    }
    try {
        const openApi = JSON.parse(await getSourceAsString(source));
        const valid = await validate(openApi, opt.verbose);

        if (opt.verbose) {
            console.log('OpenApi Json is valid :', valid);
        }
        if (valid || opt.force) {
            if (opt.verbose) {
                console.log('Initialize references');
            }


            const folder = new FolderManager(output);

            const config: IGenerateConfig = {
                ref: initReference(folder),
                folder,
                force: opt.force,
                useSpringtype: opt.useSpringtype,
                verbose: opt.verbose
            }

            createComponentInterfaces(config, openApi.components);

            createServiceClasses(config, openApi);

            copyResources(config);
        } else {
            console.error("OpenApi Json not valid.")
            process.exit(1);
            return;
        }
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}