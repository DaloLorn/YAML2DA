# YAML2DA
Neverwinter Nights 2 modding tool designed to simplify large-scale editing (such as is typically seen on most persistent worlds) of the game's 2DA files by converting them into a more flexible YAML-based format with support for various forms of cross-resource inheritance or grouping.

This tool is backed by @CromFr's excellent [nwn-lib](https://gitlab.com/CromFr/nwn-lib-rs) project, currently leveraging nwn-2da v0.3.7 for all 2DA I/O.

Currently supports a variety 2DA types out of the box, in their vanilla configurations.

<details>

<summary>Default 2DA Schemas</summary>

(Italics denote 2DA types which have default schemas written, but are disabled by default.)

- accessories
- *accessories_cat*
- *actions*
- ambientMusic
- ambientSound
- ammunitionTypes
- appearance
- appearancesndset
- areaeffects
- armor
- armorrulestats
- *armorvisualdata*
- backgrounds 
- baseitems
- *bodybag*
- *capart*
- *categories*
- *catype*
- *chargenClothes*
- classes
- cls_atk_*
- cls_bfeat_*
- cls_bsplvl_*
- cls_feat_*
- cls_savthr_*
- cls_spgn_*
- cls_spkn_*
- *combatmodes*
- *container_preference*
- *creaturesize*
- *creaturespeed*
- *cursors*
- *damagehitvisual*
- *damagelevels*
- *damagereductins*(sic)
- *defaultacsounds*
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
- race_feat_*
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

</details>

Additionally, users can define or modify 2DA types with a custom schema. This unfortunately does not fully make up for the deficiencies in the default schemas, but as the schema builder continues to evolve, the hope is to support any conceivable 2DA format one might wish to map to YAML.

## System Requirements
- Just about any Windows operating system
- [Node.js](https://nodejs.org/en)

## Installation
1. Download or clone this repository.
2. Open a shell window (Command Prompt, etc.) and run `npm install`.
3. Wait for the operation to complete.

## Running the application
1. Open a shell window.
2. Run `node yaml2da` to bring up an up-to-date help message.

## Format Documentation
See the `sample` folder for sample files. Subfolders listed in **`bold`** text contain complete subprojects based primarily on vanilla files with a few BGTSCC-specific additions (but not alterations). 

(I say "subprojects" because while they're entirely independent of each other, they're likely to be used as chunks of a larger YAML2DA project.)

<details>

<summary>Sample Files</summary>

- `cls_feat_caval.yml` is a handcrafted, annotated sample containing example uses of all YAML2DA features for the `cls_feat` type.
- `race_feat_aasim.yml` is likewise an annotated sample of the `race_feat` type.
- `includes/bonus_feat_fighter.yml` is a quick-and-dirty example of how to build partial feat lists for use with the `cls_feat` type's `import` field.
- `includes/universal_feats.yml` is a less-sloppy example of how to build an include for the `race_feat` type.
- `cls_feat_bloodmagus.yml` is a sample output from the `--import` flag. There are some stylistic deviations from the handcrafted Cavalier file above, but both files are legal YAML2DA feat lists and will generate 2DAs normally.
- `schema/bgcraft_herbs.yml` is an annotated sample of a single-schema file.
- `includes/ethereal_herb.yml` is a quick-and-dirty example of an include for the custom schema defined in `schema/bgcraft_herbs.yml`.
- `stonewort.yml` is an annotated sample of the custom schema defined in `schema/bgcraft_herbs.yml`.
- `cls_skill_battlerager.yml` is a *lightly* annotated sample of the `cls_skill` type.
- `color_calishite.yml` is likewise a lightly annotated sample of the `color` type.
- **`savingThrows`** contains an array of standard saving throw progressions, plus the progression used by BGTSCC's Phantom base class as an example of the benefits of the new `cls_savthr` schema.
- **`spellGains`** contains spell level/slot progressions for all vanilla spellcasting classes.
- **`spellsKnown`** contains spell learning progressions for all vanilla spellcasting classes.
- **`casterLevels`** contains caster level progressions for all BGTSCC PRCs, which should also suffice to cover all vanilla PRCs.
- **`baseAttackBonus`** contains the vanilla BAB progressions.
- While it's located outside the `sample` folder, the `defaultSchemas.yml` file also serves as an annotated sample of a multi-schema file.

</details>

## Recommended Workflow

<details>

<summary>Initial Setup</summary>

1. Run `node yaml2da` with the `-i` or `--import` flags on a folder containing all the 2DAs you want to import into YAML2DA. By default, an `unpacked` subfolder will be created containing the resulting YMLs, e.g. `sample/unpacked`.
    - You can also use the `-o` or `--outputFolder` options to specify a different output folder! For instance, `node yaml2da sample/packed -i -o test` will import from `sample/packed` into the `test` folder!
2. Remove all of the original 2DAs you imported from version control, if applicable. (Not retroactively, of course! There's just no need to keep committing new versions, that's all.)
3. If needed, move the unpacked 2DAs into an appropriate location (you probably don't want to accidentally pack your YMLs into a HAK, since the game can't read them anyway so the players don't need to download them!) and add them to version control.

</details>

<details>

<summary>Development & Versioning</summary>

Edit and commit the YAML files directly. ***DO NOT*** import or directly edit the 2DAs ever again: The YAML2DA formats are too feature-rich to be accurately reimported from 2DAs, and you may lose some of your work!

</details>

<details>

<summary>Deploy to Server</summary>

1. Run `node yaml2da` on the folder containing your YAML2DA project. (For instance, `node yaml2da sample` will export the sample files in this repository!) By default, a `packed` subfolder will be created containing the resulting 2DAs, e.g. `sample/packed`.
    - You can also use the `-o` or `--outputFolder` options to specify a different output folder! For instance, `node yaml2da sample -o test` will write to the `test` folder!
2. Move all of the 2DAs out of your output folder into the appropriate HAK or override folder(s) for your deployment pipeline.
3. Repack HAKs as needed.
4. Continue deployment as usual.

</details>