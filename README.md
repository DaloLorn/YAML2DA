# YAML2DA
Neverwinter Nights 2 modding tool designed to simplify large-scale editing (such as is typically seen on most persistent worlds) of the game's 2DA files by converting them into a more flexible YAML-based format.

This tool is backed by @CromFr's excellent [nwn-lib](https://gitlab.com/CromFr/nwn-lib-rs) project, currently leveraging nwn-2da v0.3.7 for all 2DA I/O.

Currently supported 2DA types:
- [cls_feat](https://nwn2.fandom.com/wiki/Cls_feat_*.2da)
- [race_feat](https://nwn2.fandom.com/wiki/Race_feat_*.2da)

## System Requirements
- Just about any Windows operating system
- [Node.js](https://nodejs.org/en)

## Installation
1. Download or clone this repository.
2. Open a shell window (Command Prompt, etc.) and run `npm install`.
3. Wait for the operation to complete.

## Running the application
1. Open a shell window.
2. Run `node yaml2da` to bring up an up-to-date list of commands.

## Format Documentation
See the `sample` folder for sample files:
- `cls_feat_caval.yml` is a handcrafted, annotated sample containing example uses of all YAML2DA features for the `cls_feat` type.
- `race_feat_aasim.yml` is likewise an annotated sample of the `race_feat` type.
- `includes/bonus_feat_fighter.yml` is a quick-and-dirty example of how to build partial feat lists for use with the `cls_feat` type's `import` field.
- `includes/universal_feats.yml` is a less-sloppy example of how to build an include for the `race_feat` type.
- `cls_feat_bloodmagus.yml` is a sample output from the `yaml2da import` command. There are some stylistic deviations from the handcrafted Cavalier file above, but both files are legal YAML2DA feat lists and will generate 2DAs normally.

## Recommended Workflow
### Initial Setup
1. Run `node yaml2da import` on a folder containing all the 2DAs you want to import into YAML2DA. An `unpacked` subfolder will be created containing the resulting YMLs.
2. Remove all of the original 2DAs you imported from version control, if applicable. (Not retroactively, of course! There's just no need to keep committing new versions, that's all.)
3. Move the unpacked 2DAs into an appropriate location (you probably don't want to accidentally pack your YMLs into a HAK, since the game can't read them anyway so the players don't need to download them!) and add them to version control.

### Development & Versioning
Edit and commit the YAML files directly. ***DO NOT*** import or directly edit the 2DAs ever again: The YAML2DA formats are too feature-rich to be accurately reimported from 2DAs, and you may lose some of your work!

### Deploy to Server
1. Run `node yaml2da export` on the folder containing your YAML2DA project. (For instance, `node yaml2da export sample` will export the sample files in this repository!) A `packed` subfolder will be created containing the resulting 2DAs.
2. Move all of the 2DAs out of `packed` into the appropriate HAK or override folder(s) for your deployment pipeline.
3. Repack HAKs as needed.
4. Continue deployment as usual.