import { keys, every, forEach, values, pickBy, negate, size, isNull, times, isEmpty, defaults, mergeWith, get, isObject, entries, set, setWith, has, last, isArray, split, isObjectLike, findIndex } from "lodash-es";
import build2DA from "./build2da.js";
import { parse, stringify } from "yaml"
import { readFile } from 'fs/promises'

const ModelTypes = {
    load,
};

const reservedSchemas = ["load", "schema", "unknown"];
const reservedAliases = ["yamlType", "generateOutput", "imports", "inherits", "id", "identifier", "variants"];

// Load defaultSchemas.yml before we continue!
(parse(await readFile(new URL(import.meta.resolve("../defaultSchemas.yml")), "utf-8"))).schemas.map(load);
export default ModelTypes;

function load(schema) {
    let loaded = false;
    const { schemas, typeName, labelField, yamlMap } = schema;
    if(typeName) {
        if(reservedSchemas.includes(typeName))
            throw new SyntaxError(`Failed to load external schema: ${typeName} is a reserved keyword!`);
        else {
            ModelTypes[typeName] = {
                postLoad: buildLoader(schema),
                validate: buildValidator(schema),
                pack: buildPacker(schema),
                unpack: buildUnpacker(schema),
                hasMultipleFiles: !!yamlMap,
                typeName,
                labelField,
            }
            loaded = true;
        }
    }
    if(schemas) {
        loaded = loaded || schemas.filter(load).length > 0;
    }
    if(!loaded)
        throw new TypeError(`Schema ${schema.identifier} has no type!`);
    return loaded;
}

function checkDuplicates(typeName, file, context) {
    if(keys(context.files[typeName]).includes(file.identifier))
        throw new ReferenceError(`${typeName} identifier ${file.identifier} is declared twice! Remember that files without an explicit "identifier" field will use their lowercased filename as an identifier!`);
}

function getDependencies(typeName, file, context, dependenciesKey) {
    return (file[dependenciesKey] || []).map((dependency) => {
        // This check shouldn't fail, but leaving it in just in case!
        if(!keys(context.files[typeName]).includes(dependency)) {
            throw new ReferenceError(`Dependency ${dependency} for ${typeName} ${file.identifier} not found in project! Either it does not exist, or there is a circular dependency somewhere!`);
        }
        return context.files[typeName][dependency];
    })
}

function buildLoader(schema) {
    const { typeName, yamlMap } = schema;
    return (file, context) => {
        let result = file;
        checkDuplicates(typeName, file, context);

        if(!yamlMap)
            result = defaults(
                result, 
                ...getDependencies(typeName, file, context, "inherits")
            );
        else 
            result = mergeWith(
                result,
                ...getDependencies(typeName, file, context, "imports"),
                (objValue, srcValue, key) => {
                    // Never import YAML2DA metadata in any way!
                    if(reservedAliases.includes(key))
                        return objValue;
            
                    // Never delete fields!
                    if(srcValue === undefined)
                        return objValue;
            
                    // Never overwrite, and mash multi-value objects together.
                    if(objValue !== undefined) {
                        // Importing potentially multi-value objects could get dicey.
                        // To simplify, we coerce both of them to an array,
                        // then mash the two arrays together.
                        //
                        // This only works because we're expecting the arrays' contents
                        // to be scalars, though, and will likely backfire catastrophically
                        // if the arrays contain objects or other arrays...
                        if(!isObject(objValue)) {
                            objValue = [objValue];
                        }
                        if(isArray(objValue)) {
                            if(!isObject(srcValue))
                                srcValue = [srcValue];
                            return [...objValue, ...srcValue.filter((val) => !objValue.includes(val))];
                        }
                        
                        // Recursively merge objects (i.e. use Lodash logic).
                        // We're checking that they're both objects, because
                        // Lodash might otherwise overwrite an object
                        // with a scalar, and I can't imagine that
                        // ever being a good idea here.
                        if(isObject(objValue) && isObject(srcValue))
                            return undefined;
            
                        // Don't overwrite single-value scalars, ever.
                        return objValue;
                    }
            
                    // We've sorted out all the special cases I can think of.
                    // Time to let Lodash take over the rest.
                    return undefined;
                }
            );
        context.files[typeName][file.identifier] = result;
    }
}

function buildValidator(schema) {
    const { columns, typeName } = schema;
    return list => {
        if(!list.yamlType) {
            return every(columns, (column, columnName) => column.optional || list.columns.includes(columnName))
        }
        else return list.yamlType === typeName;
    }
}

function getColumnAlias([key, column]) {
    if(typeof column === "string")
        return column;
    else return column?.alias || key;
}

function buildPacker(schema) {
    const { typeName, columns, yamlMap } = schema;

    if(!yamlMap) return files => {
        const rows = [];
        const aliasedColumns = entries(columns).map(getColumnAlias);
        let rowCount = 0;
        function packVariant(source, parent = times(size(columns), () => null)) {
            if(!isObjectLike(source))
                return;
            if(Number.isInteger(Number(source.id))) {
                if(rows[source.id])
                    throw new ReferenceError(`Attempted to write to ${typeName} row ID ${source.id} twice! Each row ID must occur only once in the project!`);

                rowCount++;
                rows[source.id] = aliasedColumns.map((alias, index) => source[alias] ?? parent[index]);
            }
            forEach(source.variants, variant => packVariant(variant, rows[source.id]));
        }

        forEach(files, file => packVariant(file));

        let paddedRows = [];
        for(let i = 0; i < rows.length; i++) {
            paddedRows[i] = rows[i] || times(size(columns), () => null);
        }
        return {
            packedFile: build2DA(
                keys(columns),
                paddedRows,
            ),
            rowCount,
            paddingCount: rows.length - rowCount,
            lastId: rows.length - 1,
        };
    }
    else return file => {
        const { tree, consts } = yamlMap;
        const aliasedColumns = entries(columns).map(getColumnAlias);
        // Make a map of the keys of each layer of the tree. 
        // We don't actually need to remember each layer, I guess, but
        // screw it, better safe than sorry: It already took me
        // too many attempts to puzzle out a pattern that could make this work.
        /*
            Proof of concept:
            layer 0 = [ levels.always, levels.epic... ]
            layer 1 = [ levels.always.unlocks, levels.always.grants, levels.epic.grants... ]
            layer 2 = [ levels.always.unlocks.someFeat, levels.epic.grants.otherFeat... ]

            Alternative:
            layer 0 = [ feats.someFeat, feats.otherFeat... ]

            layer 0 = [ classes.0, classes.2... ]
        */
        const treeDepth = tree.length;
        const layers = [keys(file[tree[0]]).map(key => `${tree[0]}.${key}`)];
        for(let i = 1; i < treeDepth-2; i++) {
            const prevLayer = layers[i-1];
            layers[i] = [];
            layers[i].push(...prevLayer.flatMap(nodeKey => {
                return keys(get(file, nodeKey)).map(childKey => `${nodeKey}.${childKey}`);
            }));
        }
        
        // Assuming the YAML is well-formed and the yamlMap is
        // correctly defined, the last layer will contain paths to leaf nodes.
        // These leaves correspond to 2DA rows: We just need to extract
        // their data and pack it into a nice array of objects for 
        // the next step...
        const mappers = [];
        tree.forEach((layer, index) => {
            // Always assume a non-data root layer. Things get messy
            // otherwise, with YAML2DA metadata possibly being misflagged
            // as a 2DA component!
            if(index == 0)
                return;

            // Straightforward, just fetch the column name from the schema
            // and map the layer's keys onto that column.
            if(!isObject(layer)) {
                mappers[index] = (rowStub, value) => {
                    rowStub[layer] = value;
                }
            } else {
                const { mapping, column, tuple } = layer;
                // Remaps a value to another value based on
                // the mapping rules for that value (if any).
                function applyMapping(rules, value) {                    
                    if(has(rules, value)) {
                        const rule = rules[value];
                        if(!isObject(rule)) {
                            value = rule;
                        }
                        else {
                            const src = get(file, rule.src)
                            if(src) 
                                value = src;
                            else value = rule.default ?? null;
                        }
                    }
                    return value;
                }

                // A leaf node might be a tuple instead of a scalar.
                // If so, we need to extract its contents.
                if(tuple) {
                    if(index != treeDepth-1)
                        throw new SyntaxError(`Complex schema "${typeName}" was defined with a non-leaf tuple! Tuples are only permitted for the last entry of "yamlMap.tree"!`);
                    const tupleParts = entries(tuple);

                    mappers[index] = (rowStub, value) => {
                        // Run through each key in the tuple definition,
                        // and map its contents just like we did the
                        // rest of the tree.
                        tupleParts.forEach(([part, definition]) => {
                            if(!isObject(definition)) {
                                rowStub[definition] = value[part];
                            } else {
                                rowStub[definition.column] = applyMapping(definition.mapping, value[part]);
                            }
                        })
                    }
                }
                // Not a tuple, just needs some value mappings...
                else {
                    mappers[index] = (rowStub, value) => {
                        rowStub[column] = applyMapping(mapping, value);
                    }
                }
            }
        })
        const flattenedTree = last(layers).flatMap(path => {
            // Extract all the other values from the path
            // and build a row stub with them.
            const pathComponents = split(path, ".");
            if(pathComponents.length != treeDepth - 1)
                throw new TypeError(`Found an invalid path in '${file.identifier}': schema '${typeName}' expects paths of depth ${treeDepth-1}, but '${path}' has depth ${pathComponents.length}!`);
            const rowStub = { ...consts };
            pathComponents.forEach((value, index) => {
                if(mappers[index])
                    mappers[index](rowStub, value);
            });

            // It's possible that there's multiple leaves on this
            // branch of the tree (i.e. it's an array instead of a single scalar/tuple).
            // So let's pretend it's always an array, for simplicity!
            let leafNode = get(file, path);
            if(!isArray(leafNode))
                leafNode = [leafNode];
            else if(last(layers).singleValue)
                throw new TypeError(`Found an invalid path in '${file.identifier}': schema '${typeName}' expects single-leaf branches, but '${path}' contains an array of leaf nodes:\n\n${stringify(leafNode)}`);
            return leafNode.map((value) => {
                const result = { ...rowStub };
                last(mappers)(result, value);
                return result;
            })
        });

        // Now that we've flattened the tree into an array of objects,
        // we still need to change these objects into arrays
        // to be able to build a 2DA with them. 
        // This is the easy bit, as it's just a simplified form of
        // what we do when building for a single-file schema!
        // (TODO: Find better terminology to replace "single/multi-file".)
        const rows = flattenedTree.map((row) => {
            return aliasedColumns.map((alias) => row[alias] ?? null);
        })

        return { 
            packedFile: build2DA(
                keys(columns),
                rows,
            ),
            rowCount: rows.length,
        };
    }    
}

function buildUnpacker(schema) {
    const { typeName, columns, criticalColumns, criticalColumn, yamlMap } = schema;

    return (list, printNulls) => {
        // Get 2DA indices for the columns we need to read!
        // Also all the columns that must exist in a non-padding row!
        const criticalIndices = [];
        const columnIndices = keys(columns).map(column => {
            const index = list.columns.findIndex(label => label === column)
            if(criticalColumns?.includes(column) || column === criticalColumn)
                criticalIndices.push(index);

            // Implicit aliasing isn't very useful with single-file
            // schemas, at least the ones I've written...
            // but it does sound useful for the multi-files.
            const value = columns[column];
            if(isObject(value) && !value.alias)
                value.alias = column;

            // Field names reserved for internal use by YAML2DA
            // must not be used as column aliases!
            if(reservedAliases.includes(value.alias))
                throw new SyntaxError(`Column alias '${value.alias}' for column '${column}' in schema '${typeName}' is using a reserved keyword! Edit your schema and try again!`);
            return index;
        });

        // We'll start by remapping the clunky array-of-arrays structure
        // nwn-2da gives us onto a more YAML2DA-friendly array of objects.
        // If this is a single-file schema, we can just return that array
        // and call it a day. But if it's not, having a tight association
        // between column names and values is going to make it that much
        // easier to remap onto the desired format.
        const simpleTable = list.rows.map((row, id) => {
            if(criticalIndices.every(i => row[columnIndices[i]]) == null)
                return; // We really don't need to generate files for padding/descriptive rows...
            let result = {};
            values(columns).forEach((column, i) => {
                const value = row[columnIndices[i]];
                const number = Number(value);
                // Try to coerce to a number unless explicitly instructed otherwise!
                const isNumber = !column.string && value !== null && !Number.isNaN(number);
                let mapped = isNumber ? number : value;

                if(!isObject(column)) {
                    // There can't possibly be any more transforms defined for this column!
                    result[column] = mapped;
                    return;
                }

                // Clamp numbers into the specified range.
                if(isNumber)
                    mapped = Math.min(Math.max(mapped, column.minimum ?? Number.MIN_SAFE_INTEGER), column.maximum ?? Number.MAX_SAFE_INTEGER);

                // Remap the value to its alias (if one exists).
                if(has(column.mapping, mapped))
                    mapped = column.mapping[mapped];
                result[column.alias] = mapped;
            });
            
            const resultMinusNulls = pickBy(result, negate(isNull));

            if(isEmpty(resultMinusNulls))
                return; // Doing another quick padding check!
            
            if(!printNulls)
                result = resultMinusNulls;

            return {
                yamlType: typeName,
                id,
                ...result,
            }
        }).filter(row => !!row);

        if(!yamlMap)
            return simpleTable;
        else {
            // Prepare the output object.
            const result = {
                yamlType: typeName,
                generateOutput: true,
            };
            // Precache setters for all fields that map to leaves in the
            // finished YAML.
            const mappers = [];
            values(columns).forEach((column) => {
                // A scalar column definition automatically means
                // that that column will not map to a leaf in the final YAML!
                if(!isObject(column))
                    return;
                const { path: pathSpec, alias } = column;

                // This column doesn't map to a scalar. Ignore it.
                if(!pathSpec)
                    return;
                const isTuplePart = !pathSpec.endsWith("]"); 

                mappers.push((row) => {
                    // Parse pathSpec into the actual path this cell maps to.
                    const path = pathSpec.replaceAll(/\[(\w*)\]/g, (_match, ref) => {
                        return `${row[ref]}`;
                    });

                    // Tuples need special handling on import, too...
                    if(isTuplePart) {
                        const parentPath = path.substring(0, path.lastIndexOf("."))
                        const childPath = path.substring(path.lastIndexOf(".")+1);
                        const parent = get(result, parentPath);
                        // If we've already started building leaf nodes,
                        // then we just need to keep building...
                        if(parent != null) {
                            // Find the index of the first tuple we haven't populated 
                            // this field for yet - if any exists, else append a new
                            // tuple to the array.
                            let index = findIndex(parent, (tuple) => !has(tuple, childPath));
                            if(index < 0)
                                index = parent.length;
                            
                            set(parent, `[${index}].${childPath}`, row[alias]);
                        } else {
                            const tuple = { [childPath]: row[alias] };
                            // If any step in the path is a number, and its parent
                            // doesn't exist yet, Lodash.set() will instantiate an array.
                            // This is unacceptable behavior here, so let's stop it.
                            setWith(result, parentPath, [tuple], Object);
                        }
                    } else {
                        // If we've already got a value at this path,
                        // mash the values together into an array.
                        // Otherwise, assign it as a scalar for user convenience.
                        const currentValue = get(result, path);
                        if(currentValue != null) {
                            if(isObject(currentValue))
                                currentValue.push(row[alias])
                            else set(result, path, [currentValue, row[alias]]);
                            
                        } else {
                            setWith(result, path, row[alias], Object);
                        }
                    }
                });
            });
            // Run each mapper through the table to get the final
            // YAML object we'll write to disk.
            mappers.forEach((mapper) => simpleTable.forEach(mapper));
            return result;
        }
    }
}