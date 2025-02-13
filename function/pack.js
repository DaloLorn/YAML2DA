import path from "path";
import { exec } from "child_process";
import { parse, stringify } from "yaml";
import { readFile, writeFile, stat, mkdir } from 'fs/promises';
import { forEach, groupBy, has, omit, merge } from "lodash-es";
import ModelTypes from "../util/modelTypes.js";
import readFiles from "../util/readFiles.js";

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
            console.error("The specified file is not a YAML2DA file!");
            return;
        }
        projectIdentifier = targetFile.identifier || path.basename(project).toLowerCase().replace(".yml", "");
    }
    else {
        console.error("The specified path is neither a YAML file nor a folder!");
        return;
    }

    
    const projectFiles = await readFiles(projectRoot, {
        extension: '.yml',
        loader: async (filePath, filename) => {
            return {
                filename: filename.toLowerCase(),
                contents: parse(await readFile(filePath, 'utf-8'))
            };
        },
        postFilter: file => !filterTypes?.length || [...filterTypes, 'schema'].includes(file.contents.yamlType),
    })
    const schemaFiles = await readFiles(schema, {
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
    console.log(schemaFiles)
    forEach(schemaFiles, ModelTypes.load);
    const otherFiles = omit(unloadedFiles, 'schema');
    if(!otherFiles) {
        console.error("No files were found for the requested filter(s). Please check your filters and make sure you're exporting the right folder!");
        return;
    }

    const outputFolder = customOutputFolder || path.join(projectRoot, 'packed');
    await mkdir(outputFolder, { recursive: true });

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

        if(files.length) {
            const missingDependencies = files
                .flatMap(list => list[includeType].filter(dependency => has(context.files[typeName], dependency)))
                .reduce((results, dependency) => {
                    if(!results.includes(dependency))
                        results.push(dependency)
                    return results;
                }, []);
            console.error(`One or more dependencies of type ${typeName} were not found in the project! Either they do not exist, or there is a circular dependency somewhere!
                
Unresolved dependencies: ${JSON.stringify(missingDependencies)}`);
            return;
        }

        forEach(context.files, async (type, typeName) => {
            const handler = ModelTypes[typeName];
            if(!handler)
                return;

            if(handler.hasMultipleFiles) {
                forEach(type, async file => {
                    if(file.generateOutput || file.identifier === projectIdentifier) {
                        const { packedFile, rowCount } = handler.pack(file);
                        const outputPath = path.join(outputFolder, `${file.identifier}.2da`);
                        await writeFile(outputPath, stringify(packedFile));
                        const nwn2da = exec(`nwn-2da -o "${outputPath}" -O 2da -I yaml "${outputPath}"`);
                        nwn2da.on("spawn", () => {
                            //console.log(nwn2da.spawnargs)
                        })
                        nwn2da.on("close", (code) => {
                            if(!code)
                                console.log(`Wrote ${rowCount} entries to ${file.identifier}.2da`)
                        })
                    }
                })
            }
            else {
                const { packedFile, rowCount, paddingCount, lastId } = handler.pack(type);
                const outputPath = path.join(outputFolder, `${typeName}.2da`);
                await writeFile(outputPath, stringify(packedFile));
                const nwn2da = exec(`nwn-2da -o "${outputPath}" -O 2da -I yaml "${outputPath}"`);
                nwn2da.on("spawn", () => {
                    //console.log(nwn2da.spawnargs)
                })
                nwn2da.on("close", (code) => {
                    if(!code) {
                        console.log(`Wrote ${rowCount} entries and ${paddingCount} blank rows to ${typeName}.2da, finishing on ID ${lastId}`)
                    }
                })
            }
        })
    })
    if(!exported) 
        console.error("No exportable files were found. Please make sure you have provided complete schema(s) for your project.")
}