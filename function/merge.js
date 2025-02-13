import { resolve as resolvePath } from "path";
import { parse, stringify } from "yaml";
import { readFile, writeFile, stat } from 'fs/promises';
import { forEach, omitBy } from "lodash-es";
import ModelTypes from "../util/modelTypes.js";
import readFiles from "../util/readFiles.js";

export default async function mergeFiles(options) {
    const { schema, merge: sources, args, unsafe } = options;
    const project = args[0];
    const stats = await stat(project);
    const projectRoot = resolvePath(project);
    let targetFile;
    let filterType;
    if(stats.isFile() && project.toLowerCase().endsWith(".yml")) {
        targetFile = parse(await readFile(project, 'utf-8'));
        filterType = targetFile.yamlType;
        if(!filterType) {
            console.error("The specified file is not a YAML2DA file!");
            return;
        }
    }
    else {
        console.error("The specified path is not a YAML file!");
        return;
    }

    const schemaFiles = await readFiles(schema ?? [], {
        extension: '.yml',
        loader: async (filePath, filename) => {
            const loadedFile = parse(await readFile(filePath, 'utf-8'));
            return {
                ...loadedFile,
                identifier: loadedFile.identifier || filename,
            };
        },
        postFilter: file => file.yamlType === 'schema' && file.identifier !== 'defaultSchemas',
    })
    const inputFiles = await readFiles(sources, {
        extension: '.yml',
        loader: async (file) => {
            return parse(await readFile(file, 'utf-8'))
        },
        postFilter: file => file.yamlType === filterType,
    })
    
    forEach(schemaFiles, ModelTypes.load);
    if(!inputFiles.length) {
        console.error(`None of the input files matched the destination file type "${filterType}"! Please make sure you're merging the right files!`);
        return;
    }
    const handler = ModelTypes[filterType];
    if(!handler && !unsafe) {
        console.error(`No schema was loaded for the file type "${filterType}"! Please use the --schema option to provide a path to the appropriate schema file!`);
        return;
    }
    else if(handler?.hasMultipleFiles) {
        console.error(`Schema "${filterType}" is not safe to merge! Aborting merge...`);
        return;
    }

    const variants = targetFile.variants ?? [];
    variants.push(...inputFiles.map(file => omitBy(file, (value, key) => {
        if(targetFile[key] === value)
            return true;
        return false;
    })));

    await writeFile(projectRoot, stringify(targetFile));
}