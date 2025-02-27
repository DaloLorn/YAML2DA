# YAML2DA Changelog

## 0.1.0

- Initial release featuring support for class feat lists.

### 0.1.1

- Added missing nwn-2da executable. Oops.
- Upgraded to nwn-2da 0.3.7 while I was at it, for stability.
- Added support for race_feat_*.2da files, with accompanying YAML samples.
- Laid some of the groundwork for single-file 2DAs such as classes.2da or spells.2da.
- Updated licensing from MPL 2.0 to MIT.
  
  It occurred to me that I do not (and to some extent cannot) support arbitrary schema extensions, which would, by the terms of the original license, mean that anyone who needs to add/modify schemas would have to open-source those.
  
  Granted, I'd still appreciate if *technical* improvements were sent back upstream, and 2DAs tend to become somehow publicly readable anyway... but I don't think I should be forcing that decision on people.

## 0.2.0

- Completely overhauled command-line interface more akin to nwn-lib.
    - Parameters no longer need to be provided in a specific order in order to work.
    - An input file/folder path must always be provided.
    - The application now defaults to export mode (equivalent to the old `convert`, `build`, `finalize`, `pack`, `to2da`, or `export` commands).
    - The `--import` (`-i`) option tells YAML2DA to run in import mode (equivalent to the old `prepare`, `unpack`, `import`, or `from2da` commands).
    - The `--filterType` (`-f`) option accepts a `yamlType` value (e.g. `cls_feat`), equivalent to passing a second parameter to the old `pack` command.
    - The `--help` (`-h`) option displays a list of possible options.
- Exporter can filter by more than one `yamlType` now, by providing multiple values for `--filterType`.
- Importer can now use `--filterType` to filter out 2DAs incompatible with a given list of `yamlType`s.
- Both import and export modes now allow for a custom output folder via `--outputFolder` (`-o`), simplifying their integration into existing release automation.
- Added support for user-defined single-file schemas!
    - Although these only provide a direct column-to-field mapping of 2DA rows to YAML objects, the resulting YMLs still support the rest of the YAML2DA featureset (most notably inheritance).
    - The `imports` field for these single-file schemas is replaced by `inherits`.
        - Where `imports` merged the dependencies into the final file, `inherits` uses the parent's fields as default values instead of defaulting to `****`.
        - Inheritance is applied sequentially, from top to bottom, with each new ancestor overriding the previous one. For instance, if `ethereal_herb` defines a field `ethereal: 1`, and `non_ethereal_herb` defines a field `ethereal: null`, then a file specifying `inherits: [ethereal_herb, non_ethereal_herb]` will resolve to `ethereal: null` unless it explicitly specifies a value for `ethereal`.
    - Single-file schemas also include a mandatory `id` field representing the row ID. 
        - If left blank (or otherwise not coercible to an integer), the file's contents will not be included in the exported 2DA!
        - Row IDs must be unique across the project for any given schema.
        - Row IDs do not need to be contiguous: Empty rows will be inserted as necessary to maintain table integrity between exports. (For instance, a spell file with ID 10 will always be printed to spells.2da row 10, regardless of whether any spells were defined with IDs 0-9.)
    - Exporting a project to 2DA will automatically search for custom schemas within the project folder. Additionally, the `--schema` (`-s`) option can be used to specify the locations of extra schema files not inside the project folder; this is also the only way to use a custom schema when importing 2DAs!
    - For easier use, single-file schemas are imported into a subfolder with the same name as the source file. YAML2DA does not enforce any specific folder structure or file naming scheme, however, so you are free to do what you want after import!
    - Custom schemas with a `yamlType` of `load`, `schema`, or `unknown` will not be loaded.
    - As a performance optimization, custom schemas will not be loaded from any schema file whose identifier is either implicitly or explicitly set to `defaultschemas`, in case you accidentally tell YAML2DA to reload the default schema file.
        - Reminder: Any YAML2DA file without an `identifier` field will use the file's lowercased name (e.g. `defaultSchemas.yml` becomes `defaultschemas`) instead.
    - Schema includes/inheritance are not currently supported. Sorry!
- Defined default schemas for *a lot* of single-file 2DAs:
    - accessories
    - ambientMusic
    - ambientSound
    - ammunitionTypes
    - appearance
    - appearancesndset
    - areaeffects
    - armor
    - armorrulestats
    - backgrounds
    - baseitems
    - classes
    - disease
    - domains
    - doortypes
    - effecticons
    - feat
    - genericdoors
    - hen_companion
    - hen_familiar
    - itempropdef
    - nwn2_deities
    - packages
    - placeableobjsnds
    - placeables
    - poison
    - polymorph
    - racialsubtypes
    - racialtypes
    - skills
    - sneakfeats (defined by xp_dae plugin)
    - sneakgroups (defined by xp_dae plugin)
    - spells
    - tailmodel
    - traps
    - vfx_persistent
    - visualeffects
    - weaponsounds
    - wingmodel

### 0.2.1

- Added new schema option: `labelField`. If specified in a single-file schema, filenames will try to follow the pattern `${row[labelField]}_${row.id}.yml` instead of the default `${row.id}.yml`.
    - Some characters that are legal in a 2DA cell may not be legal in a Windows filename! These will be stripped out, so filenames may not *fully* match the 2DA label in all cases.
    - Unlike `criticalColumn` and `criticalColumns`, `labelField` refers to a YAML field instead of a 2DA column. Like those other fields, it is case-sensitive, so watch your spelling when writing schemas!
    - If desired, the `--labelInvert` (`-l`) option can be used to invert the naming scheme to `${row.id}_${row[labelField]}.yml`. This may be more convenient for small 2DAs with a few (under 100 or so) rows.
- Row IDs in filenames are now zero-padded for proper alphabetization.
    - Don't worry: This is strictly a filesystem QoL change, and will not be reflected in the YAML data.
- Updated all default schemas (and the `bgcraft_herbs` sample) with hopefully-appropriate values of `labelField`.
- ... Also caught a syntax error in 0.2.0, because of *course* I did a stupidly minor thing to completely break the application in between testing and committing the silly thing. :joy:

### 0.2.2

- Fixed broken schemas for classes.2da and feat.2da.
- Vastly increased maximum buffer size for importing 2DAs, so the tool should no longer crash on trying to import large 2DAs.
- Exporter now generates fully-formed instead of minified 2DAs, for better compatibility.
- Added new command line option, `--printNulls` (`-p`). When set, YAML2DA will no longer ignore null cells when importing a 2DA, and will include them in the resulting YMLs. Does not do anything when exporting.
- Importer now tries to coerce cell values to numbers, to stop unnecessarily quoting them.

### 0.2.3

- Fixed an oversight where the exporter never actually digested the custom schemas it loaded, preventing it from exporting 2DAs for those schemas. (Reproducible on the sample files with the following commands: `node yaml2da sample -f bgcraft_herbs` and `node yaml2da sample`, where the former throws an error and the latter just fails to pack `bgcraft_herbs.2da`.)

### 0.2.4

- Fixed another oversight where the exporter failed to apply inheritance rules for single-file schemas.

## 0.3.0

- **Added support for custom tree schemas (in the vein of cls_feat and race_feat)**. Tree schemas use the new `columns[colName].path` and `yamlMap` schema fields, and cannot function without both of these.
    - Examples and end-user documentation for this, as well as all other additions in this update, can be reviewed under the cls_feat schema in `defaultSchemas.yml`.
    - By their very nature, tree schemas are multi-file schemas (i.e. each YML exports to a separate 2DA, instead of being mashed together into a single 2DA).
- Replaced the hardcoded cls_feat and race_feat importers with default tree schemas.
- Added support for custom value mappers (like how GrantedOnLevel 1 maps to "always" when importing cls_feat, and vice versa) via the `columns[colName].mapping` and `yamlMap.tree[colAlias].mapping` schema fields.
    - This also supports retrieving the mapped value from a metadata field (e.g. mapping "epic" to the value of `epicFrom`) on export, with an optional default value if the field doesn't exist.
- Added support for clamping imported values to a certain range via the `columns[colName].minimum` and `columns[colName].maximum` schema fields. Clamping is only applied to numerical values; other cells are imported verbatim.
    - Numerical clamping applies before mapping. For instance, GrantedOnLevel -1 would clamp to 1, which then maps to "always".
    - Exported numbers aren't being clamped at this time. Really, the only reason I added this feature in the first place was because it was part of the old cls_feat importer.
- The `columns[colName].alias` field is no longer required, and can be automatically inferred from `colName`.
- Fixed an issue where single-file export would throw a TypeError because I wasn't supplying the file encoding to `readFile`. (Parentheses in the wrong places. It happens.)
- Fixed an issue where the cls_feat importer would mistakenly map all feats to List 0 (`unlocks`).
- Fixed a QoL issue where the `generateOutput` metadata field (if applicable) would be printed at the very bottom of an imported file. It now prints at the top, devoting the rest of the file exclusively to converted 2DA data.
- Fixed some poorly copy-pasted documentation in race_feat_aasim.yml.
- Refactored a few chunks of `modelTypes.js`.

### 0.3.1

- Fixed an issue where single-file exports were flooding the file with null values.
- Fixed a typo in an error message.
- Some minor refactoring.

## 0.4.0

- Added `variants` YAML field for single-file schemas. This allows multiple similar 2DA rows to be populated from a single file. (It doesn't do anything fundamentally different from regular inheritance, but can be organizationally useful to group variants of a base entity together.)
    - Variants can have their own `variants` field containing subvariants (with their own subsubvariants, and so on...).
    - A variant with neither a 2DA ID nor subvariants will be silently ignored.
    - A file does not need to have a root-level ID to register variants.
    - Variants do not have identifiers (and can therefore not be inherited from by another file).
    - Variants cannot use the `inherits` field (and are therefore incapable of inheriting from another file).

## 0.5.0

- Trying to use the `--filterType` and `--schema` options without any arguments now shows an error message and exits.
- The `--schema` option now supports recursively loading schemas from a folder, as opposed to having to explicitly specify the path to each individual schema file.
- Added `--merge` (`-m`) option.
    - Supersedes `--import`.
    - Will exit with an error if the input path is a folder.
    - Takes a nonzero amount of additional file/folder paths.
    - Ignores the following options:
        - `--filterType`: Will simply read the `yamlType` of the input file and use that as a filter, instead.
        - `--printNulls`: Is an import-only option.
        - `--labelInvert`: Is an import-only option.
        - `--outputFolder`: Outputs everything into the input file.
    - Will merge all of the specified files into the input file as variants.
    - Only works for single-file schemas, and will refuse to work without a schema for the target file.
        - Use the `--unsafe` (`-u`) option to ignore missing schemas.
- Renamed build_2da.js to build2da.js for consistency with the other camel-cased files.
- More refactoring! Always!
- Rewrote readme to better showcase the tool's current features.
- Rewrote package description to better describe the tool's purpose.

## 0.6.0

- Leaf nodes in a tree schema can now be defined as containing tuples instead of scalars, using the new `yamlMap.tree[leafIndex].tuple` property.
    - Only the leaf layer can contain tuples. Defining a schema with non-leaf tuples will throw an error.
    - 2DA columns with a `path` ending in a hardcoded path component (not ending in `]`) will now import into an array of tuples instead of generating unexportable files.
    - Individual properties of a tuple can be mapped using the `mapping` field. See the `cls_featmap` schema for an example.
- Leaf nodes in a tree schema can now be defined as strictly single-value (i.e. no arrays allowed) using the new `yamlMap.tree[leafIndex].singleValue` property.
    - Unlike the `tuple` property, `singleValue` is legal for non-leaf layers, but will not do anything.
- Added new column property, `columns[colName].string`. If set, YAML2DA will stop trying to import its contents as a number. (This is useful for representing things like hex codes, where it could result in accidental data corruption.)
- Added default schemas for the following 2DA types:
    - cls_featmap_* (NOTE: I have not tested what happens if class IDs are sparse or otherwise non-sequential inside a featmap! Do not delete values corresponding to non-caster classes without further testing... and do let me know if you've tested it!)
    - cls_skill_* ~~(It's safe to delete all cross-class skills, by the way!)~~
    - cls_pres_*
    - color_*
    - csl_lang (DMFI language dictionaries, at least as used on BGTSCC)
    - diffsettings
    - encdifficulty
- Changed import intermediary format to JSON for safer imports from 2DA.
- Added sample files for `cls_skill` and `color` types. Lightly annotated, just covering a couple of key details I thought needed pointing out.

## 0.7.0

- Autogenerated identifiers are no longer forcibly lowercased, and instead use the original filename (minus extension) verbatim.
    - This is *technically* a breaking change, but only in a very specific scenario I can't imagine happening. (And in any case, it's fixable with a few replace-in-folder operations, one for each affected identifier. Any text editor worth its salt should have you sorted in a jiffy.)
- Fixed a bug where specifying only a single parameter for `--filterType` would prevent YAML2DA from correctly filtering files.
    - This may also have caused similar issues with the `--schema` and `--merge` options, but I've forgotten enough about their implementation to be sure and I don't feel like digging it up.
- Fixed a bug where trying to export a single file would export all files of the same type.
- Fixed a bug where trying to list missing dependencies would instead erroneously list off all *found* dependencies for the files whose dependencies were missing.
- Added new `schemaType` schema property to support schemas whose type cannot be (easily) inferred from context.
- Added new `defaultRow` schema property to support non-null default values.
    - Uses 2DA column labels, not YAML2DA aliases.
    - Columns not referenced in `defaultRow` will still default to null (i.e. `****`).
    - Currently only used by the exporter. The importer needs some more work...
    - Does not apply to level progression schemas (see below).
- Added two schema types related to level progression: Accumulators and level lists.
    - Accumulators are identified by `schemaType: levelAccumulator`, and carry values over from each preceding row. (Example 2DA types, to help understand the principle: `cls_atk`, `cls_savthr`, `cls_spgn`, `cls_spkn`.)
    - Level lists are identified by `schemaType: levelList`, and the contents of each row are independent of all other rows. (Examples: `cls_bfeat` and `cls_bsplvl`.)
    - The resulting schemas otherwise behave identically in every way.
    - Cannot be automatically imported from 2DA at this time.
    - Can only hold procedural numerical progressions, as in the abovementioned example 2DA types.
        - This may be changed in a later update.
    - Always generates a 60-row table.
    - Defining a column with `isLevelColumn: true` causes it to automatically fill with values equal to `rowID+1`, matching the pattern of the `Level` column in 2DAs such as `cls_savthr`.
    - The new `formula` column field denotes a YAML path to a formula used to compute the base value of each column used to compute the value of each column.
        - Currently, each formula is just a level multiplier for accumulators, and a constant base value for level lists. Support for more complicated formulae may be added in a later update.
    - The new `bonus` column field denotes a YAML path from `levels[levelNumber]` containing a flat bonus/penalty to that column's value on `levelNumber`. (For instance, adding the +2 save bonus on level 1 to high save progressions, or adding an extra spell level at Wizard 3.)
    - Both of the above fields will default to `alias` if omitted.
    - Defining a column with `defaultNull` will cause it to output `****` instead of 0 if it has no bonus specified for that level. (This is essential for `cls_spgn`. 0 has a special meaning there, as demonstrated by bards, rangers, and paladins.)
    - Is always a multi-file schema, but still uses the `inherits` keyword (and all of the associated logic) instead of `imports` to include dependencies.
        - `imports` needs to be refactored anyway, it won't behave properly with single-leaf tree schemas (see `singleValue` in the 0.6.0 changelog for a reminder on what those are). At that point, it's possible that the two keywords will become synonymous...
- Added default schemas for the following 2DA types:
    - cls_atk
    - cls_bfeat
    - cls_bsplvl
    - cls_savthr
    - cls_spgn
    - cls_spkn
- Added a pile of samples for the following YAML types, emulating all vanilla files I could think of, plus a few extras from BGTSCC. Each of these is essentially a complete YAML2DA project, and can be mixed and matched with the others at will:
    - cls_atk
    - cls_bsplvl
    - cls_savthr
    - cls_spgn
    - cls_spkn