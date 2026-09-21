# Mote Rumble content pipeline (headless editor Python).
#
#   UnrealEditor-Cmd MoteRumble.uproject -run=pythonscript -script=Tools/import_content.py \
#       -unattended -nosplash -nop4
#
# Idempotent. Does four things:
#   1. imports the Thrixel GLBs as static meshes at the paths DESIGN.md promises
#   2. imports SourceAudio/*.wav as sound waves (mus_* loop)
#   3. authors the /Game/FX materials the C++ drives by parameter name
#   4. rebuilds /Game/Maps/Arena: sun, sky, clouds, fog, post process
#
# Art/audio roots can be overridden with MOTE_ART_ROOT / MOTE_AUDIO_ROOT.

import os
import unreal

PROJECT_DIR = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
ART_ROOT = os.environ.get(
    "MOTE_ART_ROOT", os.path.normpath(os.path.join(PROJECT_DIR, "..", "..", "thrixel_assets", "mote_rumble"))
)
AUDIO_ROOT = os.environ.get("MOTE_AUDIO_ROOT", os.path.join(PROJECT_DIR, "SourceAudio"))

EAL = unreal.EditorAssetLibrary
MEL = unreal.MaterialEditingLibrary
ATH = unreal.AssetToolsHelpers.get_asset_tools()

FIGHTERS = ["Blade", "Arc", "Disc", "Maul", "Bow", "Flare", "Cinder", "Veil"]


def log(msg):
    unreal.log("MoteContent: {}".format(msg))


def warn(msg):
    unreal.log_warning("MoteContent: {}".format(msg))


# ---------------------------------------------------------------------------
# 1. meshes
# ---------------------------------------------------------------------------

def build_mesh_manifest():
    """canonical asset name -> (source glb, /Game folder)."""
    m = {}
    for f in FIGHTERS:
        key = f.lower()
        m["SM_{}_Body".format(f)] = (os.path.join(ART_ROOT, "fighters", "{}_body.glb".format(key)), "/Game/Art/Fighters")
        m["SM_{}_Gauntlet".format(f)] = (
            os.path.join(ART_ROOT, "fighters", "{}_gauntlet.glb".format(key)), "/Game/Art/Fighters")
        # Flare's "weapon" is its gauntlets; it has a weapon file anyway, skip only if missing.
        m["SM_{}_Weapon".format(f)] = (os.path.join(ART_ROOT, "weapons", "{}_weapon.glb".format(key)), "/Game/Art/Weapons")
    m["SM_Bow_Arrow"] = (os.path.join(ART_ROOT, "weapons", "bow_arrow.glb"), "/Game/Art/Weapons")
    for name, fn in (
        ("SM_Arena_Platform", "arena_platform_flipped.glb"),
        ("SM_Sky_Island", "sky_island.glb"),
        ("SM_Crystal_Cluster", "crystal_cluster.glb"),
        ("SM_Ruined_Pillar", "ruined_pillar.glb"),
        ("SM_Brazier", "brazier.glb"),
    ):
        m[name] = (os.path.join(ART_ROOT, "arena", fn), "/Game/Art/Arena")
    # Fall back to the untextured blockouts if a final file never landed.
    fallbacks = {
        "SM_Arena_Platform": os.path.join(ART_ROOT, "arena", "arena_platform.glb"),
        "SM_Brazier": os.path.join(ART_ROOT, "arena", "brazier_raw.glb"),
    }
    for name, alt in fallbacks.items():
        src, folder = m[name]
        if not os.path.isfile(src) and os.path.isfile(alt):
            m[name] = (alt, folder)
    return m


def make_interchange_options(recompute_normals=False):
    """
    One combined static mesh, no collision, no Nanite.

    Interchange ignores a bare pipeline object on the task: it has to be handed
    over inside a pipeline stack override, which is what actually makes
    "combine" stick (without it a Thrixel GLB lands as 15 separate meshes).
    """
    try:
        pipeline = unreal.InterchangeGenericAssetsPipeline()
    except Exception as e:
        warn("no Interchange pipeline ({}), using importer defaults".format(e))
        return None

    def prop(obj, name, value):
        try:
            obj.set_editor_property(name, value)
            return True
        except Exception:
            return False

    mesh = None
    try:
        mesh = pipeline.get_editor_property("mesh_pipeline")
    except Exception:
        pass
    if mesh:
        if not prop(mesh, "combine_static_meshes_behavior", unreal.InterchangeCombineStaticMeshesBehavior.ALL):
            warn("could not set combine_static_meshes_behavior")
        prop(mesh, "collision", False)
        prop(mesh, "import_collision_according_to_mesh_name", False)
        prop(mesh, "build_nanite", False)
        prop(mesh, "import_skeletal_meshes", False)
        prop(mesh, "import_static_meshes", True)
    prop(pipeline, "import_level_sequence", False)

    try:
        stack = unreal.InterchangePipelineStackOverride()
        stack.add_pipeline(pipeline)
        return stack
    except Exception as e:
        warn("pipeline stack override unavailable ({}), passing pipeline directly".format(e))
        return pipeline


def import_mesh(name, source, folder, recompute_normals=False):
    dest = "{}/{}".format(folder, name)
    if EAL.does_asset_exist(dest):
        return "exists"
    if not os.path.isfile(source):
        return "missing source"

    staging = "/Game/Art/_Import/{}".format(name)
    if EAL.does_directory_exist(staging):
        EAL.delete_directory(staging)

    task = unreal.AssetImportTask()
    task.filename = source
    task.destination_path = staging
    task.automated = True
    task.replace_existing = True
    task.save = False
    options = make_interchange_options(recompute_normals)
    if options:
        task.options = options
    ATH.import_asset_tasks([task])

    meshes = [
        a for a in EAL.list_assets(staging, recursive=True, include_folder=False)
        if EAL.find_asset_data(a).asset_class_path.asset_name == "StaticMesh"
    ]
    if not meshes:
        return "import produced no static mesh"

    # With combining on there should be exactly one; keep the heaviest regardless.
    def tri_count(path):
        try:
            mesh = EAL.load_asset(path)
            return mesh.get_num_triangles(0)
        except Exception:
            return 0

    meshes.sort(key=tri_count, reverse=True)
    EAL.make_directory(folder)
    if not EAL.rename_asset(meshes[0], dest):
        return "rename failed"
    make_two_sided(EAL.load_asset(dest))
    EAL.save_asset(dest)
    return "imported"


def make_two_sided(mesh):
    """
    Thrixel's sculpts have single-sided surfaces whose winding can end up facing
    away from the camera after the glTF conversion (the arena deck came in
    invisible from above). Forcing the materials two-sided costs little on this
    many objects and makes the art robust whichever way a face points.
    """
    if not mesh:
        return
    try:
        materials = mesh.get_editor_property("static_materials")
    except Exception:
        return
    for slot in materials:
        mi = slot.material_interface
        if not isinstance(mi, unreal.MaterialInstanceConstant):
            continue
        try:
            ov = mi.get_editor_property("base_property_overrides")
            ov.set_editor_property("override_two_sided", True)
            ov.set_editor_property("two_sided", True)
            mi.set_editor_property("base_property_overrides", ov)
            EAL.save_asset(mi.get_path_name())
        except Exception as e:
            warn("two-sided {}: {}".format(mi.get_name(), e))


def import_meshes():
    log("art root: {}".format(ART_ROOT))
    results = {}
    for name, (source, folder) in sorted(build_mesh_manifest().items()):
        status = import_mesh(name, source, folder)
        results[name] = status
        (log if status in ("imported", "exists") else warn)("{:<22} {}".format(name, status))
    return results


# ---------------------------------------------------------------------------
# 2. audio
# ---------------------------------------------------------------------------

def import_audio():
    if not os.path.isdir(AUDIO_ROOT):
        warn("no audio root at {}".format(AUDIO_ROOT))
        return
    wavs = sorted(f for f in os.listdir(AUDIO_ROOT) if f.lower().endswith(".wav"))
    if not wavs:
        warn("no wavs in {}".format(AUDIO_ROOT))
        return
    todo = []
    for wav in wavs:
        name = os.path.splitext(wav)[0]
        if EAL.does_asset_exist("/Game/Audio/{}".format(name)):
            continue
        task = unreal.AssetImportTask()
        task.filename = os.path.join(AUDIO_ROOT, wav)
        task.destination_path = "/Game/Audio"
        task.destination_name = name
        task.automated = True
        task.replace_existing = True
        task.save = True
        todo.append(task)
    if todo:
        ATH.import_asset_tasks(todo)
    # Music loops.
    for wav in wavs:
        name = os.path.splitext(wav)[0]
        path = "/Game/Audio/{}".format(name)
        if name.startswith("mus_") and EAL.does_asset_exist(path):
            wave = EAL.load_asset(path)
            try:
                wave.set_editor_property("looping", True)
                EAL.save_asset(path)
            except Exception as e:
                warn("loop flag on {}: {}".format(name, e))
    log("audio: {} wav(s) present".format(len(wavs)))


# ---------------------------------------------------------------------------
# 3. FX materials
# ---------------------------------------------------------------------------

def new_material(name):
    path = "/Game/FX/{}".format(name)
    if EAL.does_asset_exist(path):
        EAL.delete_asset(path)
    return ATH.create_asset(name, "/Game/FX", unreal.Material, unreal.MaterialFactoryNew())


def expr(mat, cls, x=0, y=0):
    return MEL.create_material_expression(mat, cls, x, y)


def scalar(mat, name, value, x=-900, y=0):
    node = expr(mat, unreal.MaterialExpressionScalarParameter, x, y)
    node.set_editor_property("parameter_name", name)
    node.set_editor_property("default_value", value)
    return node


def vector(mat, name, color, x=-900, y=0):
    node = expr(mat, unreal.MaterialExpressionVectorParameter, x, y)
    node.set_editor_property("parameter_name", name)
    node.set_editor_property("default_value", color)
    return node


def mul(mat, a, b, x=-500, y=0, a_out="", b_out=""):
    node = expr(mat, unreal.MaterialExpressionMultiply, x, y)
    MEL.connect_material_expressions(a, a_out, node, "A")
    MEL.connect_material_expressions(b, b_out, node, "B")
    return node


def add(mat, a, b, x=-500, y=0):
    node = expr(mat, unreal.MaterialExpressionAdd, x, y)
    MEL.connect_material_expressions(a, "", node, "A")
    MEL.connect_material_expressions(b, "", node, "B")
    return node


def one_minus(mat, a, x=-600, y=0):
    node = expr(mat, unreal.MaterialExpressionOneMinus, x, y)
    MEL.connect_material_expressions(a, "", node, "")
    return node


def lerp(mat, a, b, alpha, x=-450, y=0):
    node = expr(mat, unreal.MaterialExpressionLinearInterpolate, x, y)
    MEL.connect_material_expressions(a, "", node, "A")
    MEL.connect_material_expressions(b, "", node, "B")
    MEL.connect_material_expressions(alpha, "", node, "Alpha")
    return node


def constant(mat, value, x=-900, y=0):
    node = expr(mat, unreal.MaterialExpressionConstant, x, y)
    node.set_editor_property("r", value)
    return node


def saturate(mat, a, x=-700, y=0):
    node = expr(mat, unreal.MaterialExpressionClamp, x, y)
    MEL.connect_material_expressions(a, "", node, "")
    return node


def fresnel(mat, exponent_node=None, exponent=2.5, x=-800, y=300):
    node = expr(mat, unreal.MaterialExpressionFresnel, x, y)
    if exponent_node is not None:
        MEL.connect_material_expressions(exponent_node, "", node, "ExponentIn")
    else:
        try:
            node.set_editor_property("exponent", exponent)
        except Exception:
            pass
    return node


def finish(mat, unlit=True, blend=unreal.BlendMode.BLEND_ADDITIVE, two_sided=True):
    if unlit:
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
    mat.set_editor_property("blend_mode", blend)
    mat.set_editor_property("two_sided", two_sided)
    # Usage flags are NOT inferred. Without these the engine silently swaps in
    # the default grey material at runtime and only whispers about it in the
    # log - which is exactly what happened to the arena's 90 drifting embers,
    # an InstancedStaticMeshComponent, for the life of the project.
    for flag in ("used_with_instanced_static_meshes",
                 "used_with_static_lighting",
                 "used_with_particle_sprites",
                 "used_with_mesh_particles"):
        try:
            mat.set_editor_property(flag, True)
        except Exception:
            pass
    MEL.recompile_material(mat)
    EAL.save_asset(mat.get_path_name())


def make_fx_materials():
    EAL.make_directory("/Game/FX")

    # --- M_FX_Additive: glows, orbs, flashes -------------------------------
    mat = new_material("M_FX_Additive")
    col = vector(mat, "Color", unreal.LinearColor(1, 1, 1, 1), -1100, 0)
    intensity = scalar(mat, "Intensity", 4.0, -1100, 200)
    opacity = scalar(mat, "Opacity", 1.0, -1100, 320)
    rim_power = scalar(mat, "RimPower", 0.0, -1100, 440)
    # soft ball falloff: bright centre, faded edge, mixed in by RimPower
    fres = fresnel(mat, rim_power, x=-900, y=560)
    soft = one_minus(mat, fres, -750, 560)
    mix = saturate(mat, rim_power, -900, 700)
    one = constant(mat, 1.0, -900, 780)
    shape = lerp(mat, one, soft, mix, -600, 640)
    body = mul(mat, col, intensity, -500, 0)
    body = mul(mat, body, opacity, -380, 0)
    body = mul(mat, body, shape, -260, 0)
    MEL.connect_material_property(body, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    MEL.connect_material_property(mul(mat, opacity, shape, -260, 400), "", unreal.MaterialProperty.MP_OPACITY)
    finish(mat)

    # --- M_FX_Ring: shockwaves, halos, telegraphs on a plane ---------------
    mat = new_material("M_FX_Ring")
    col = vector(mat, "Color", unreal.LinearColor(1, 1, 1, 1), -1300, 0)
    intensity = scalar(mat, "Intensity", 5.0, -1300, 160)
    opacity = scalar(mat, "Opacity", 1.0, -1300, 280)
    radius = scalar(mat, "RingRadius", 0.8, -1300, 400)
    width = scalar(mat, "RingWidth", 0.12, -1300, 520)
    uv = expr(mat, unreal.MaterialExpressionTextureCoordinate, -1300, 660)
    centre = expr(mat, unreal.MaterialExpressionConstant2Vector, -1300, 780)
    centre.set_editor_property("r", 0.5)
    centre.set_editor_property("g", 0.5)
    offset = expr(mat, unreal.MaterialExpressionSubtract, -1100, 700)
    MEL.connect_material_expressions(uv, "", offset, "A")
    MEL.connect_material_expressions(centre, "", offset, "B")
    dist = expr(mat, unreal.MaterialExpressionDistance, -950, 700)
    MEL.connect_material_expressions(offset, "", dist, "A")
    zero = expr(mat, unreal.MaterialExpressionConstant2Vector, -1100, 840)
    MEL.connect_material_expressions(zero, "", dist, "B")
    two = constant(mat, 2.0, -1100, 920)
    d = mul(mat, dist, two, -820, 700)
    # Ring mask: 1 - |d - RingRadius| / RingWidth, clamped and squared for a soft falloff.
    diff = expr(mat, unreal.MaterialExpressionSubtract, -700, 860)
    MEL.connect_material_expressions(d, "", diff, "A")
    MEL.connect_material_expressions(radius, "", diff, "B")
    absdiff = expr(mat, unreal.MaterialExpressionAbs, -580, 860)
    MEL.connect_material_expressions(diff, "", absdiff, "")
    ratio = expr(mat, unreal.MaterialExpressionDivide, -460, 860)
    MEL.connect_material_expressions(absdiff, "", ratio, "A")
    MEL.connect_material_expressions(width, "", ratio, "B")
    inv = one_minus(mat, ratio, -340, 860)
    ring = saturate(mat, inv, -240, 860)
    ring = mul(mat, ring, ring, -140, 860)
    body = mul(mat, col, intensity, -500, 0)
    body = mul(mat, body, opacity, -380, 0)
    body = mul(mat, body, ring, -60, 0)
    MEL.connect_material_property(body, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    MEL.connect_material_property(mul(mat, opacity, ring, -60, 300), "", unreal.MaterialProperty.MP_OPACITY)
    finish(mat)

    # --- M_FX_Ribbon: weapon trails, slash crescents, lightning ------------
    mat = new_material("M_FX_Ribbon")
    col = vector(mat, "Color", unreal.LinearColor(1, 1, 1, 1), -1200, 0)
    intensity = scalar(mat, "Intensity", 6.0, -1200, 160)
    opacity = scalar(mat, "Opacity", 1.0, -1200, 280)
    uv = expr(mat, unreal.MaterialExpressionTextureCoordinate, -1200, 420)
    u = expr(mat, unreal.MaterialExpressionComponentMask, -1000, 420)
    u.set_editor_property("r", True)
    u.set_editor_property("g", False)
    MEL.connect_material_expressions(uv, "", u, "")
    v = expr(mat, unreal.MaterialExpressionComponentMask, -1000, 560)
    v.set_editor_property("r", False)
    v.set_editor_property("g", True)
    MEL.connect_material_expressions(uv, "", v, "")
    age = one_minus(mat, u, -860, 420)          # 1 at the head, 0 at the tail
    age2 = mul(mat, age, age, -740, 420)
    # soft edges across the ribbon: 1 - |2V - 1|
    v2 = mul(mat, v, constant(mat, 2.0, -1000, 700), -860, 560)
    vc = expr(mat, unreal.MaterialExpressionSubtract, -740, 560)
    MEL.connect_material_expressions(v2, "", vc, "A")
    MEL.connect_material_expressions(constant(mat, 1.0, -860, 700), "", vc, "B")
    vabs = expr(mat, unreal.MaterialExpressionAbs, -620, 560)
    MEL.connect_material_expressions(vc, "", vabs, "")
    edge = one_minus(mat, vabs, -500, 560)
    shape = mul(mat, age2, edge, -380, 480)
    body = mul(mat, col, intensity, -500, 0)
    body = mul(mat, body, opacity, -380, 0)
    body = mul(mat, body, shape, -240, 0)
    MEL.connect_material_property(body, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    MEL.connect_material_property(mul(mat, opacity, shape, -240, 300), "", unreal.MaterialProperty.MP_OPACITY)
    finish(mat)

    # --- M_FX_Smoke: dust and smoke puffs ----------------------------------
    mat = new_material("M_FX_Smoke")
    col = vector(mat, "Color", unreal.LinearColor(0.5, 0.5, 0.5, 1), -900, 0)
    opacity = scalar(mat, "Opacity", 0.6, -900, 180)
    rim_power = scalar(mat, "RimPower", 2.0, -900, 300)
    fres = fresnel(mat, rim_power, x=-900, y=440)
    soft = one_minus(mat, fres, -700, 440)
    MEL.connect_material_property(col, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    MEL.connect_material_property(mul(mat, opacity, soft, -400, 300), "", unreal.MaterialProperty.MP_OPACITY)
    finish(mat, blend=unreal.BlendMode.BLEND_TRANSLUCENT)

    # --- M_FX_Shield: the shield bubble ------------------------------------
    mat = new_material("M_FX_Shield")
    col = vector(mat, "Color", unreal.LinearColor(0.4, 0.8, 1, 1), -900, 0)
    intensity = scalar(mat, "Intensity", 2.5, -900, 180)
    opacity = scalar(mat, "Opacity", 0.5, -900, 300)
    fres = fresnel(mat, None, 2.5, -900, 440)
    fill = add(mat, fres, constant(mat, 0.12, -900, 560), -700, 440)
    body = mul(mat, col, intensity, -560, 0)
    body = mul(mat, body, fill, -420, 0)
    body = mul(mat, body, opacity, -300, 0)
    MEL.connect_material_property(body, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    MEL.connect_material_property(mul(mat, opacity, fill, -300, 320), "", unreal.MaterialProperty.MP_OPACITY)
    finish(mat)

    # --- M_FX_Overlay: hit flash + rim on the fighters ----------------------
    mat = new_material("M_FX_Overlay")
    flash_col = vector(mat, "FlashColor", unreal.LinearColor(1, 1, 1, 1), -1100, 0)
    flash_amt = scalar(mat, "FlashAmount", 0.0, -1100, 160)
    rim_col = vector(mat, "RimColor", unreal.LinearColor(0.5, 0.9, 1, 1), -1100, 300)
    rim_amt = scalar(mat, "RimAmount", 0.0, -1100, 460)
    fres = fresnel(mat, None, 2.5, -1100, 600)
    flash = mul(mat, flash_col, flash_amt, -800, 0)
    flash = mul(mat, flash, constant(mat, 2.0, -950, 120), -650, 0)
    rim = mul(mat, rim_col, rim_amt, -800, 300)
    rim = mul(mat, rim, fres, -650, 300)
    rim = mul(mat, rim, constant(mat, 2.5, -950, 420), -520, 300)
    total = add(mat, flash, rim, -380, 120)
    MEL.connect_material_property(total, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    alpha = add(mat, flash_amt, mul(mat, rim_amt, fres, -700, 700), -560, 640)
    MEL.connect_material_property(saturate(mat, alpha, -420, 640), "", unreal.MaterialProperty.MP_OPACITY)
    finish(mat)

    log("FX materials authored")


# ---------------------------------------------------------------------------
# 4. the level
# ---------------------------------------------------------------------------

MAP_PATH = "/Game/Maps/Arena"


def set_props(obj, **kwargs):
    for name, value in kwargs.items():
        try:
            obj.set_editor_property(name, value)
        except Exception as e:
            warn("{}.{}: {}".format(type(obj).__name__, name, e))


def component_of(actor, cls):
    try:
        return actor.get_component_by_class(cls)
    except Exception:
        return None


def build_level():
    level_sub = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actor_sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

    # new_level() refuses to overwrite an existing map and fails SILENTLY - the
    # spawns then land in an untitled level that never gets written. Step off
    # the map, delete it, and only then create it fresh.
    scratch = "/Game/Maps/_Scratch"
    level_sub.new_level(scratch)
    if EAL.does_asset_exist(MAP_PATH):
        if not EAL.delete_asset(MAP_PATH):
            warn("could not delete existing {}".format(MAP_PATH))
    if not level_sub.new_level(MAP_PATH):
        warn("new_level({}) failed".format(MAP_PATH))

    def spawn(cls, loc=(0, 0, 0), rot=(0, 0, 0), label=None):
        """rot is (pitch, yaw, roll) - unreal.Rotator's positional args are
        (roll, pitch, yaw), which silently flattened the sun to the horizon."""
        pitch, yaw, roll = rot
        try:
            actor = actor_sub.spawn_actor_from_class(
                cls, unreal.Vector(*loc), unreal.Rotator(roll=roll, pitch=pitch, yaw=yaw))
        except Exception as e:
            warn("spawn {} raised {}".format(label or cls, e))
            return None
        if not actor:
            warn("spawn {} returned nothing".format(label or cls))
            return None
        if label:
            try:
                actor.set_actor_label(label)
            except Exception:
                pass
        log("spawned {}".format(label or cls))
        return actor

    # --- sun: low, warm, raking across the arena from behind/right ---------
    sun = spawn(unreal.DirectionalLight, (0, 0, 1200), (-26.0, 28.0, 0.0), "Sun")
    sun_c = component_of(sun, unreal.DirectionalLightComponent)
    # Lights spawn Static. With static lighting disabled (this project is fully
    # dynamic/Lumen) a static light contributes NOTHING, which leaves the whole
    # scene lit only by the sky.
    set_props(sun_c, mobility=unreal.ComponentMobility.MOVABLE)
    set_props(
        sun_c,
        # The deck is a 17 m pale-albedo disc and the only large surface whose
        # normal faces the sun's hemisphere, so it collects ~85% of its light
        # from this one source (measured: its cast shadow sits at 0.15 of the
        # lit deck in scene-linear). At 26 - 2.6x the engine default - it
        # rendered two stops over mid grey, up on the tonemapper's shoulder
        # where the stone's texture contrast gets squashed flat. The ambient
        # lost here comes back on the SkyLight below, which barely touches an
        # up-facing surface this sun-dominated.
        intensity=20.0,
        light_color=unreal.Color(255, 206, 155),
        cast_shadows=True,
        dynamic_shadow_distance_movable_light=30000.0,
        atmosphere_sun_light=True,
        light_source_angle=1.2,
        volumetric_scattering_intensity=2.0,
    )
    # --- atmosphere: put the planet surface kilometres below the arena -----
    atmos = spawn(unreal.SkyAtmosphere, (0, 0, -120000.0), label="SkyAtmosphere")
    atmos_c = component_of(atmos, unreal.SkyAtmosphereComponent)
    set_props(
        atmos_c,
        transform_mode=unreal.SkyAtmosphereTransformMode.PLANET_TOP_AT_COMPONENT_TRANSFORM,
        rayleigh_scattering_scale=0.035,
        mie_scattering_scale=0.0035,
        aerial_pespective_view_distance_scale=0.05,
        height_fog_contribution=0.0,
        aerial_perspective_start_depth=8.0,
    )

    # --- a sea of clouds below the floating arena --------------------------
    clouds = spawn(unreal.VolumetricCloud, (0, 0, 0), label="Clouds")
    clouds_c = component_of(clouds, unreal.VolumetricCloudComponent)
    set_props(
        clouds_c,
        layer_bottom_altitude=0.35,
        layer_height=0.7,
        tracing_max_distance=60.0,
        ground_albedo=unreal.Color(120, 110, 100),
    )

    sky = spawn(unreal.SkyLight, (0, 0, 600), label="SkyLight")
    sky_c = component_of(sky, unreal.SkyLightComponent)
    set_props(sky_c, mobility=unreal.ComponentMobility.MOVABLE)
    # Pays back the sun trim on everything that is NOT the deck: the fighters'
    # shaded volumes, the platform rim, the island undersides (measured at
    # 0.066 sRGB - crushed on the toe). Up-facing stone is only ~15% ambient,
    # so this lifts those without re-lifting the deck. It does not touch the
    # sky on screen - SkyAtmosphere draws that; the SkyLight is only IBL.
    set_props(sky_c, real_time_capture=True, intensity=1.3, volumetric_scattering_intensity=2.0)

    fog = spawn(unreal.ExponentialHeightFog, (0, 0, -1500), label="HeightFog")
    fog_c = component_of(fog, unreal.ExponentialHeightFogComponent)
    set_props(
        fog_c,
        fog_density=0.00008,
        fog_height_falloff=0.5,
        fog_inscattering_luminance=unreal.LinearColor(1.0, 0.72, 0.48, 1.0),
        fog_max_opacity=0.18,
        volumetric_fog=True,
        volumetric_fog_scattering_distribution=0.3,
        volumetric_fog_albedo=unreal.Color(255, 240, 225),
        volumetric_fog_extinction_scale=0.6,
        start_distance=6000.0,
    )

    # --- post process ------------------------------------------------------
    ppv = spawn(unreal.PostProcessVolume, (0, 0, 0), label="PostProcess")
    set_props(ppv, unbound=True, priority=1.0)
    settings = ppv.get_editor_property("settings")

    def pp(name, value):
        """Set a post-process field and its bOverride_ flag, whatever it is called."""
        try:
            settings.set_editor_property(name, value)
        except Exception as e:
            warn("pp {}: {}".format(name, e))
            return
        for flag in ("override_" + name, "b_override_" + name):
            try:
                settings.set_editor_property(flag, True)
                return
            except Exception:
                continue

    # Adaptive but tightly bounded: bright and stable, never flickering.
    pp("auto_exposure_method", unreal.AutoExposureMethod.AEM_HISTOGRAM)
    pp("auto_exposure_min_brightness", 0.05)
    pp("auto_exposure_max_brightness", 6.0)
    pp("auto_exposure_speed_up", 4.0)
    pp("auto_exposure_speed_down", 2.0)
    pp("auto_exposure_bias", 0.6)
    # Exposure is NOT hunting. Measured across frames 400-1800 (every 50th) a
    # fixed deck patch holds a median of 0.606..0.803 sRGB (1 sigma 0.049)
    # straight through the KO flashes at 499/925, with no dip-and-recover after
    # either - so the histogram rails and the bias above are not the defect, and
    # lowering the bias would only drag the sky and the fighters down with the
    # deck.
    #
    # The defect is dynamic range. On frame_01050 the sky reads 0.332 sRGB while
    # the deck reads 0.68..0.72, roughly two stops higher, up where the film
    # curve's slope collapses - so the stone's albedo variation renders at
    # reduced contrast. The deck is not clipped (max 0.779, no deck pixel above
    # 0.99); it is compressed.
    #
    # Local exposure reduces contrast of the BASE layer above mid grey only, and
    # hands the detail layer back at full strength. Because the sky sits at the
    # pivot and the fighters at or below it, that lands on the deck and little
    # else. Leave shadow contrast at its 1.0 default: the toe is fine, and
    # lifting it would flatten the cast shadows. A highlight value below 1.0 is
    # on its own enough to enable the feature (PostProcessing.cpp:799-805).
    #
    # Do NOT reach for color_contrast instead. UE's grading contrast pivots at
    # ACEScc mid grey, so raising it pushes the deck - which is ABOVE mid grey -
    # brighter still and makes the wash worse. Do NOT trim the sun either: it is
    # spawned with atmosphere_sun_light=True, and SkyAtmosphere's in-scattering
    # is linear in its illuminance (DirectionalLightComponent.cpp:582), so
    # dimming the sun dims the sky, the sun disc and the cloud sea with it.
    #
    # These four constants are fitted from the captured PNGs, not from a render.
    # Expect one tuning pass, and check a capture for bilateral ringing along
    # the deck's edge against the sky and around the fighters.
    pp("local_exposure_highlight_contrast_scale", 0.60)
    pp("local_exposure_detail_strength", 1.40)
    pp("local_exposure_blurred_luminance_blend", 0.50)
    pp("local_exposure_blurred_luminance_kernel_size_percent", 40.0)
    pp("bloom_intensity", 0.45)
    pp("bloom_threshold", 0.3)
    pp("vignette_intensity", 0.4)
    pp("film_grain_intensity", 0.08)
    pp("color_saturation", unreal.Vector4(1.12, 1.08, 1.02, 1.0))
    pp("color_contrast", unreal.Vector4(1.06, 1.05, 1.04, 1.0))
    pp("white_temp", 7400.0)
    # The engraved rings are shallow surface relief; a 120 cm radius is far
    # wider than the grooves, so AO was contributing almost nothing to their
    # read. Tighter and a little stronger puts the contact darkening back into
    # the rings and under the fighters.
    pp("ambient_occlusion_intensity", 0.75)
    pp("ambient_occlusion_radius", 70.0)
    pp("dynamic_global_illumination_method", unreal.DynamicGlobalIlluminationMethod.LUMEN)
    pp("reflection_method", unreal.ReflectionMethod.LUMEN)
    pp("lumen_final_gather_quality", 2.0)
    pp("motion_blur_amount", 0.0)
    ppv.set_editor_property("settings", settings)

    spawn(unreal.PlayerStart, (-900.0, 0.0, 300.0), (0, 0, 0), "PlayerStart")

    saved = level_sub.save_current_level()
    if EAL.does_asset_exist(scratch):
        EAL.delete_asset(scratch)
    log("level rebuilt: {} (saved={})".format(MAP_PATH, saved))


# ---------------------------------------------------------------------------

def main():
    log("=== content pipeline start ===")
    make_fx_materials()
    import_meshes()
    import_audio()
    build_level()
    try:
        unreal.EditorAssetLibrary.save_directory("/Game", only_if_is_dirty=True, recursive=True)
    except Exception as e:
        warn("save_directory: {}".format(e))
    log("=== content pipeline done ===")


main()
