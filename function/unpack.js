import path from "path";
import sanitize from "sanitize-filename";
import { exec } from "child_process";
import { parse, stringify } from "yaml";
import { writeFile, stat, readdir, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { find, forEach } from "lodash-es";
import ModelTypes from "../util/modelTypes.js";
import { promisify } from "util";

export default async function unpackFrom2DA(options) {
    const { outputFolder: customOutputFolder, filterType: filterTypes, schema, args, labelInvert, printNulls } = options;
    const project = args[0];
    const stats = await stat(project);
    let projectRoot;
    let projectFiles;
    if(stats.isDirectory()) {
        projectRoot = path.resolve(project)
        projectFiles = (await readdir(path.resolve(project), {withFileTypes: true}))
            .filter(file => file.isFile() && file.name.toLowerCase().endsWith(".2da"))
            .map(file => path.join(file.path, file.name));
    }
    else if(stats.isFile()){
        projectRoot = path.dirname(path.resolve(project))
        projectFiles = [path.resolve(project)]
    }
    else {
        throw new TypeError("The specified path is neither a 2DA file nor a folder!");
    }
    const outputFolder = customOutputFolder || path.join(projectRoot, "unpacked");
    if(!existsSync(outputFolder))
        await mkdir(outputFolder)

    const schemaFiles = await Promise.all(schema.map(async file => {
        const loadedFile = parse(await readFile(file, 'utf-8'));
        return {
            ...loadedFile,
            identifier: loadedFile.identifier || file,
        }
    }))
    forEach(schemaFiles, ModelTypes.load)

    let imported = false;
    await Promise.all(projectFiles.map(async file => {
        const execPromise = promisify(exec);
        const {stdout: output, stderr: error} = await execPromise(`nwn-2da -O yaml "${file}"`, { maxBuffer: 1024*1024*10 })
        if(!error) {
            const parsed2DA = parse(output);
            const handler = find(ModelTypes, handler => handler.validate && handler.validate(parsed2DA) && (!filterTypes?.length || filterTypes.includes(handler.typeName)));
            if(!handler)
                return;
            // If we have a handler for at least one of our files,
            // then either we'll throw an error or we'll write something!
            imported = true; 

            if(handler.hasMultipleFiles) {
                const outputFile = path.join(outputFolder, `${path.basename(file.toLowerCase(), ".2da")}.yml`)
                await writeFile(outputFile, stringify(handler.unpack(parsed2DA, printNulls)));
                console.log(`Unpacked ${path.basename(file)}`);
            }
            else {
                const outputSubfolder = path.join(outputFolder, path.basename(file.toLowerCase(), ".2da"));
                if(!existsSync(outputSubfolder))
                    await mkdir(outputSubfolder)
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
                    const outputFile = path.join(outputSubfolder, sanitize(filename));
                    writeFile(outputFile, stringify(row));
                })
                console.log(`Unpacked ${unpackedRows.length} out of ${parsed2DA.rows.length} rows from ${path.basename(file)} (omitted rows were interpreted as padding)`)
            }
        }
        else console.error(error)
    }))
    if(!imported) 
        console.error("No importable files were found. Please check your filters, and make sure you have provided complete schema(s) for your project using the --schema parameter.")
}