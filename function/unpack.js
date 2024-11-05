import path from "path";
import { exec } from "child_process";
import { parse, stringify } from "yaml";
import { writeFile, stat, readdir, mkdir } from "fs/promises";
import { existsSync } from "fs";
import ClassFeatList from "../model/cls_feat.js";

export default async function unpackFrom2DA(params) {
    const project = params[0];
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
    const outputFolder = path.join(projectRoot, "unpacked");
    if(!existsSync(outputFolder))
        await mkdir(outputFolder)

    projectFiles.forEach(file => {
        const outputFile = path.join(outputFolder, `${path.basename(file.toLowerCase(), ".2da")}.yml`)
        const nwn2da = exec(`nwn-2da -O yaml "${file}"`, async (error, output, stderr) => {
            if(!error) {
                const parsed2DA = parse(output);
                let unpacked = false;
                if(ClassFeatList.validate(parsed2DA)) {
                    unpacked = true;
                    await writeFile(outputFile, stringify(ClassFeatList.unpack(parsed2DA)))
                }
                console.log(`Unpacked ${path.basename(file)}`)
            }
            else console.error(stderr)
        })
        nwn2da.on("spawn", () => {
            //console.log(nwn2da.spawnargs)
        })
    })
}