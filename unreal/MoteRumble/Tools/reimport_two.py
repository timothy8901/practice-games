
import unreal
EAL = unreal.EditorAssetLibrary
for p in ("/Game/Art/Weapons/SM_Blade_Weapon", "/Game/Art/Arena/SM_Arena_Platform"):
    if EAL.does_asset_exist(p):
        EAL.delete_asset(p)
exec(open(r"/Users/tim/games/.claude/worktrees/dazzling-solomon-81258c/unreal/MoteRumble/Tools/import_content.py").read())
