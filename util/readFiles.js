import { readdir, stat } from 'fs/promises';
import { join as joinPath, basename } from 'path';
import { defaults } from 'lodash-es';

const defaultOptions = {
    extension: "",
    loader: () => { throw new SyntaxError("Tried to use readFiles without a loader function!") },
    postFilter: () => true,
    recursive: true,
}

export default async function readFiles(paths, options) {
    if(!paths?.length)
        return [];
    if(typeof paths !== 'object')
        paths = [paths];
    defaults(options, defaultOptions);
    const { extension, loader, postFilter, recursive } = options;
    const results = await Promise.all(paths.map(async path => {
        const stats = await stat(path);
        if(stats.isDirectory()) {
            return await Promise.all((await readdir(path, {
                withFileTypes: true,
                recursive,
            }))
                .filter(file => file.isFile() && (!extension || file.name.toLowerCase().endsWith(extension)))
                .map(async file => {
                    const result = await loader(joinPath(file.parentPath ?? file.path, file.name), file.name);
                    if(postFilter(result))
                        return result;
                })
            );
        } else if(stats.isFile()) {
            const result = await loader(path, basename(path));
            if(postFilter(result))
                return result;
        }
    }))
    return results.flat().filter(value => !!value);
}