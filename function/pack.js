import path from "path";
import { exec } from "child_process";
import { parse, stringify } from "yaml";
import { readFile, writeFile, stat, readdir, mkdir } from 'fs/promises';
import { existsSync } from "fs";
import { forEach, groupBy, has, omit, filter, merge } from "lodash-es";
import ModelTypes from "../util/modelTypes.js";

export default async function packTo2DA(options) {
    const { outputFolder: customOutputFolder, filterType, schema, args } = options;
    const project = args[0];
    const stats = await stat(project);
    let projectRoot;
    let filterTypes;
    let projectIdentifier;
    if(stats.isDirectory()) {
        projectRoot = path.resolve(project)
        filterTypes = filterType;
    }
    else if(stats.isFile() && project.toLowerCase().endsWith(".yml")) {
        projectRoot = path.dirname(path.resolve(project))
        const targetFile = parse(await readFile(project, 'utf-8'));
        filterTypes = [targetFile.yamlType];
        if(!filterTypes) {
            throw new TypeError("The specified file is not a YAML2DA file!")
        }
        projectIdentifier = targetFile.identifier || path.basename(project).toLowerCase().replace(".yml", "");
    }
    else {
        throw new TypeError("The specified path is neither a YAML file nor a folder!")
    }

    const projectFiles = await Promise.all((await readdir(projectRoot, {
        withFileTypes: true,
        recursive: true,
    }))
        .filter(file => file.isFile() && file.name.toLowerCase().endsWith(".yml"))
        .map(async file => {
            const result = {
                filename: file.name.toLowerCase(),
                contents: parse(await readFile(path.join(file.path, file.name), 'utf-8'))
            }
            return result
        }))
        .then(files => files.filter(file => !filterTypes?.length || [...filterTypes, 'schema'].includes(file.contents.yamlType)));
    const schemaFiles = await Promise.all(schema.map(async file => {
        const loadedFile = parse(await readFile(file, 'utf-8'));
        return {
            ...loadedFile,
            identifier: loadedFile.identifier || file,
        }
    }))

    const unloadedFiles = omit(
        groupBy(
            projectFiles.map(file => {
                const result = {
                    ...file.contents,
                    identifier: file.contents.identifier || file.filename.replace('.yml', ''),
                }
                return result;
            }),
            file => file.yamlType || 'unknown',
        ),
        'unknown'
    );

    merge(schemaFiles, unloadedFiles.schema);
    forEach(schemaFiles, ModelTypes.load);
    const otherFiles = omit(unloadedFiles, 'schema');
    if(!otherFiles) {
        console.error("No files were found for the requested filter(s). Please check your filters and make sure you're exporting the right folder!");
        return;
    }

    const outputFolder = customOutputFolder || path.join(projectRoot, 'packed');
    if(!existsSync(outputFolder))
        await mkdir(outputFolder)

    const context = {
        files: {},
    };

    let exported = false;
    forEach(otherFiles, (type, typeName) => {
        const handler = ModelTypes[typeName];
        if(!handler)
            return;
        // If we have a handler for at least one of our files,
        // then either we'll throw an error or we'll write something!
        exported = true; 

        const includeType = handler.hasMultipleFiles ? "imports" : "inherits";

        context.files[typeName] = {};
        let files = type;
        let previous = 0;
        const loadedFiles = [];
        while(files.length != previous) {
            const nextBatch = files.filter(file => (file[includeType] || []).every(dependency => has(context.files[typeName], dependency)));
            nextBatch.forEach(file => handler.postLoad(file, context));
            loadedFiles.push(...nextBatch);

            previous = files.length;
            files = files.filter(file => !loadedFiles.find(entry => entry.identifier == file.identifier));
        }

        if(files.length != 0) {
            const missingDependencies = files
                .flatMap(list => list[includeType].filter(dependency => has(context.files[typeName], dependency)))
                .reduce((results, dependency) => {
                    if(!results.includes(dependency))
                        results.push(dependency)
                    return results;
                }, []);
            throw new ReferenceError(`One or more dependencies of type ${typeName} were not found in the project! Either they do not exist, or there is a circular dependency somewhere!
                
Unresolved dependencies: ${JSON.stringify(missingDependencies)}`);
        }

        forEach(context.files, async (type, typeName) => {
            const handler = ModelTypes[typeName];
            if(!handler)
                return;

            if(handler.hasMultipleFiles) {
                forEach(type, async file => {
                    if(file.generateOutput || file.identifier === projectIdentifier) {
                        const packedFile = handler.pack(file);
                        const outputPath = path.join(outputFolder, `${file.identifier}.2da`);
                        await writeFile(outputPath, stringify(packedFile));
                        const nwn2da = exec(`nwn-2da -o "${outputPath}" -O 2da -I yaml "${outputPath}"`);
                        nwn2da.on("spawn", () => {
                            //console.log(nwn2da.spawnargs)
                        })
                        nwn2da.on("close", (code) => {
                            if(!code)
                                console.log(`Wrote ${file.identifier}.2da`)
                        })
                    }
                })
            }
            else {
                const packedFile = handler.pack(type);
                const outputPath = path.join(outputFolder, `${typeName}.2da`);
                await writeFile(outputPath, stringify(packedFile));
                const nwn2da = exec(`nwn-2da -o "${outputPath}" -O 2da -I yaml "${outputPath}"`);
                nwn2da.on("spawn", () => {
                    //console.log(nwn2da.spawnargs)
                })
                nwn2da.on("close", (code) => {
                    if(!code) {
                        const rowCount = filter(type, file => file.id !== undefined).length;
                        const paddingCount = packedFile.rows.length - rowCount;
                        console.log(`Wrote ${rowCount} entries and ${paddingCount} blank rows to ${typeName}.2da, finishing on ID ${packedFile.rows.length-1}`)
                    }
                })
            }
        })
    })
    if(!exported) 
        console.error("No exportable files were found. Please make sure you have provided complete schema(s) for your project.")
}