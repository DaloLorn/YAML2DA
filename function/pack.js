import path from "path";
import { exec } from "child_process";
import { parse, stringify } from "yaml";
import { readFile, writeFile, stat, readdir, mkdir } from 'fs/promises';
import { existsSync } from "fs";
import ClassFeatList from "../model/cls_feat.js";

export default async function packTo2DA(params) {
    const project = params[0];
    const stats = await stat(project);
    let projectRoot;
    let filterType;
    let projectIdentifier;
    if(stats.isDirectory()) {
        projectRoot = path.resolve(project)
    }
    else if(stats.isFile() && project.toLowerCase().endsWith(".yml")) {
        projectRoot = path.dirname(path.resolve(project))
        const targetFile = parse(await readFile(project), 'utf-8');
        filterType = targetFile.yamlType;
        if(!filterType) {
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
        .then(files => files.filter(file => !filterType || file.contents.yamlType === filterType));

    const context = {
        files: {
            cls_feat: {},
        }
    };

    if(!filterType || filterType === "cls_feat") {
        let classFeatLists = projectFiles
            .filter(file => file.contents.yamlType === "cls_feat")
            .map(file => {
                const result = {
                        ...file.contents,
                        identifier: file.contents.identifier || file.filename.replace('.yml', ''),
                    };
                return result;
            })
        const loadedClassFeatLists = [];
        let previous = 0;
        while(classFeatLists.length != previous) {
            const nextBatch = classFeatLists.filter(list => (list.imports || []).every(dependency => Object.keys(context.files.cls_feat).includes(dependency)));
            nextBatch.forEach(list => ClassFeatList.postLoad(list, context));
            loadedClassFeatLists.push(...nextBatch);

            previous = classFeatLists.length;
            classFeatLists = classFeatLists.filter(list => !loadedClassFeatLists.includes(list));
        }

        if(classFeatLists.length != 0) {
            const missingDependencies = classFeatLists
                .flatMap(list => list.imports.filter(dependency => !Object.keys(context.files.cls_feat).includes(dependency)))
                .reduce((results, dependency) => {
                    if(!results.includes(dependency))
                        results.push(dependency)
                    return results;
                }, []);
            throw new ReferenceError(`One or more dependencies were not found in the project! Either they do not exist, or there is a circular dependency somewhere!
                
Unresolved dependencies: ${JSON.stringify(missingDependencies)}`);
        }

        const outputFolder = path.join(projectRoot, 'packed');
        if(!existsSync(outputFolder))
            await mkdir(outputFolder)
        Object.values(context.files.cls_feat).forEach(async featList => {
            if(featList.generateOutput || featList.identifier === projectIdentifier) {
                const packedList = {
                    file_type: "2DA ",
                    file_version: "V2.0",
                    columns: [ "FeatLabel", "FeatIndex", "List", "GrantedOnLevel", "OnMenu" ],
                    rows: ClassFeatList.pack(featList),
                }
                const outputPath = path.join(outputFolder, `${featList.identifier}.2da`);
                await writeFile(outputPath, stringify(packedList));
                const nwn2da = exec(`nwn-2da -o "${outputPath}" -O 2da-mini -I yaml "${outputPath}"`);
                nwn2da.on("spawn", () => {
                    //console.log(nwn2da.spawnargs)
                })
                nwn2da.on("close", (code) => {
                    if(!code)
                        console.log(`Wrote ${featList.identifier}.2da`)
                })
            }
        })
    }
}