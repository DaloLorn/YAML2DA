import { resolve as resolvePath, join as joinPath, basename, dirname } from "path";
import sanitize from "sanitize-filename";
import { exec } from "child_process";
import { parse, stringify } from "yaml";
import { writeFile, stat, readFile, mkdir } from "fs/promises";
import { find, forEach } from "lodash-es";
import ModelTypes from "../util/modelTypes.js";
import { promisify } from "util";
import readFiles from "../util/readFiles.js";

const execPromise = promisify(exec);

export default async function unpackFrom2DA(options) {
    const { outputFolder: customOutputFolder, filterType: filterTypes, schema, args, labelInvert, printNulls } = options;
    const project = args[0];
    const stats = await stat(project);
    let projectRoot;
    let projectFiles;
    if(stats.isDirectory()) {
        projectRoot = resolvePath(project);
        projectFiles = await readFiles([projectRoot], {
            extension: '.2da',
            loader: file => file,
            recursive: false,
        })
    }
    else if(stats.isFile()){
        const projectFile = resolvePath(project);
        projectRoot = dirname(projectFile);
        projectFiles = [projectFile];
    }
    else {
        console.error("The specified path is neither a 2DA file nor a folder!");
        return;
    }
    const outputFolder = customOutputFolder || joinPath(projectRoot, "unpacked");
    await mkdir(outputFolder, { recursive: true });

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
    forEach(schemaFiles, ModelTypes.load)

    let imported = false;
    await Promise.all(projectFiles.map(async file => {
        const {stdout: output, stderr: error} = await execPromise(`nwn-2da -O json "${file}"`, { maxBuffer: 1024*1024*10 })
        if(!error) {
            const parsed2DA = parse(output);
            const handler = find(ModelTypes, handler => handler.validate && handler.validate(parsed2DA) && (!filterTypes?.length || filterTypes.includes(handler.typeName)));
            if(!handler)
                return;
            // If we have a handler for at least one of our files,
            // then either we'll throw an error or we'll write something!
            imported = true; 

            if(handler.hasMultipleFiles) {
                const outputFile = joinPath(outputFolder, `${basename(file.toLowerCase(), ".2da")}.yml`)
                const unpacked = handler.unpack(parsed2DA, printNulls);
                if(unpacked === "stub") {
                    console.log(`Could not unpack ${basename(file)}: Schema type does not yet support importing.`);
                }
                else {
                    await writeFile(outputFile, stringify(handler.unpack(parsed2DA, printNulls)));
                    console.log(`Unpacked ${basename(file)}`);
                }
            }
            else {
                const outputSubfolder = joinPath(outputFolder, basename(file.toLowerCase(), ".2da"));
                await mkdir(outputSubfolder, { recursive: true });
                const unpackedRows = handler.unpack(parsed2DA, printNulls);
                const hasLabelField = !!handler.labelField;
                const idDigitCount = Math.log10(unpackedRows.length) + 1;
                await unpackedRows.forEach(async row => {
                    let filename;
                    const paddedId = String(row.id).padStart(idDigitCount, '0');
                    if(hasLabelField) {
                        if(labelInvert)
                            filename = `${paddedId}_${row[handler.labelField]}.yml`;
                        else
                            filename = `${row[handler.labelField]}_${paddedId}.yml`;
                    }
                    else
                        filename = `${paddedId}.yml`;
                    const outputFile = joinPath(outputSubfolder, sanitize(filename));
                    writeFile(outputFile, stringify(row));
                })
                console.log(`Unpacked ${unpackedRows.length} out of ${parsed2DA.rows.length} rows from ${basename(file)} (omitted rows were interpreted as padding)`)
            }
        }
        else console.error(error)
    }))
    if(!imported) 
        console.error("No importable files were found. Please check your filters, and make sure you have provided complete schema(s) for your project using the --schema parameter.")
}