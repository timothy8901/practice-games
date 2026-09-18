// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "MoteTypes.generated.h"

class AMoteCharacter;

// ============================================================================
//  Mote Rumble - shared gameplay types.
//
//  Units are Unreal's: centimetres, seconds, degrees. The arena is centred on
//  the world origin with the walkable top of the platform at Z = 0.
//
//  Damage is a Smash-style PERCENT that only goes up; knockback grows with it,
//  and fighters are KO'd by leaving the blast zones, never by running out of
//  health.
// ============================================================================

/** The eight fighters. Each Mote is defined by the Core it absorbed. */
UENUM(BlueprintType)
enum class EMoteCore : uint8
{
	Blade,
	Arc,
	Disc,
	Maul,
	Bow,
	Flare,
	Cinder,
	Veil,
	Count UMETA(Hidden)
};

/** Every fighter has the same six move slots. */
UENUM(BlueprintType)
enum class EMoteMoveSlot : uint8
{
	Jab1,      // Light, ground: first hit of the combo
	Jab2,      // Light, ground: second hit (buffered during Jab1)
	Jab3,      // Light, ground: combo finisher, launches
	Heavy,     // Heavy, ground: the fighter's signature, hold to charge
	AirLight,  // Light, airborne
	AirHeavy,  // Heavy, airborne
	Count UMETA(Hidden)
};

/** Where a move's hitbox lives relative to the attacker. */
UENUM(BlueprintType)
enum class EMoteHitShape : uint8
{
	None,    // No melee hitbox (projectile-only or remote strike)
	Arc,     // Horizontal sweep in front: Reach + Radius within ArcDegrees
	Sphere,  // A ball at Reach in front of the attacker
	Radial,  // A ring all the way round the attacker (spins, slams)
	Thrust   // A capsule from the attacker out to Reach (stabs, lunges)
};

/**
 * The procedural animation archetype a move plays. UMoteAnimator owns the
 * choreography for each one; the fighter only says which is playing and how far
 * through it is.
 */
UENUM(BlueprintType)
enum class EMoteMoveAnim : uint8
{
	SlashRight,      // Weapon sweeps from the fighter's right across to its left
	SlashLeft,       // Back-hand sweep, left to right
	Thrust,          // Straight stab forward
	Uppercut,        // Rising strike from low to high (launcher)
	Overhead,        // Big two-handed chop from above, down in front
	SpinSlash,       // Full 360 horizontal spin, weapon out
	Twirl,           // Polearm/parasol twirled in front, multi-hit
	ThrowForward,    // Wind back then fling something forward (disc, bomb)
	Lob,             // Underarm toss in a high arc (bombs)
	DrawBow,         // Draw a bow, hold (charge), release
	BowBash,         // Swipe with the bow itself
	PunchRight,      // Right gauntlet jab
	PunchLeft,       // Left gauntlet jab
	FlameUppercut,   // Rising flaming uppercut
	DashStrike,      // Whole body lunges forward, weapon leading
	GroundSlam,      // Weapon raised high then smashed into the floor
	Plunge,          // Airborne: point the weapon down and dive
	ParasolSpin,     // Parasol held open and spun around the body (reflects)
	Drill,           // Spinning forward thrust, multi-hit
	Cast,            // Weapon raised skyward to call a strike at range
	Count UMETA(Hidden)
};

/** What a hit looks and sounds like. Drives sparks, sounds, and hitstop feel. */
UENUM(BlueprintType)
enum class EMoteFxType : uint8
{
	Slash,
	Blunt,
	Pierce,
	Fire,
	Electric,
	Explosion,
	Energy
};

/** Projectiles and remote strikes a move can emit when it goes active. */
UENUM(BlueprintType)
enum class EMoteProjectileKind : uint8
{
	None,
	Arrow,       // Fast, straight, optional piercing
	Disc,        // Spinning chakram; can return to the thrower
	Bomb,        // Lobbed, bounces once, explodes on fighter contact or fuse
	EnergyBolt,  // Glowing orb, straight
	Fireball,    // Short-lived burst travelling forward, explodes
	Lightning    // Not a projectile: a delayed bolt from the sky at range
};

/** How a fighter holds its weapon - the animator poses the hands from this. */
UENUM(BlueprintType)
enum class EMoteWeaponHold : uint8
{
	OneHandRight,  // Sword/parasol/disc in the right hand, left hand free
	TwoHanded,     // Glaive/hammer: right hand on the grip, left further up
	BowLeft,       // Bow in the left hand, right hand draws
	Gauntlets,     // No weapon mesh: the gauntlets are the weapon
	BombRight      // A bomb sits in the right hand and is re-summoned after throws
};

/** Top-level fighter state. Everything else (move phase, jumps...) is detail. */
UENUM(BlueprintType)
enum class EMoteFighterState : uint8
{
	Inactive,     // Not in play (menus, before the intro)
	Idle,         // Free: grounded or airborne, can act
	Attacking,    // Executing a move (see phase)
	Shielding,
	Dodging,      // Roll on the ground, directional air dodge in the air
	Hitstun,      // Launched / reeling; no control until it expires
	ShieldBroken, // Dizzy after the shield shatters
	KO,           // Blasted out, waiting to respawn
	Respawning,   // On the respawn halo, invulnerable, waiting to drop
	Victory       // Match over, posing
};

UENUM(BlueprintType)
enum class EMoteMovePhase : uint8
{
	None,
	Charging,   // Heavy held: startup paused and charge accumulating
	Startup,
	Active,
	Recovery
};

// ----------------------------------------------------------------------------
//  Data
// ----------------------------------------------------------------------------

/** One move. All timings in seconds. Damage is percent. */
USTRUCT(BlueprintType)
struct FMoteMoveDef
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString Name;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) EMoteMoveAnim Anim = EMoteMoveAnim::SlashRight;

	UPROPERTY(EditAnywhere, BlueprintReadOnly) float Startup = 0.10f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float Active = 0.08f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float Recovery = 0.20f;

	// ---- hitbox ----
	UPROPERTY(EditAnywhere, BlueprintReadOnly) EMoteHitShape Shape = EMoteHitShape::Arc;
	/** Distance in front of the attacker's centre to the hit centre (Arc: to the arc's outer edge). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float Reach = 150.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float Radius = 90.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float ArcDegrees = 140.f;
	/** Vertical offset of the hit centre from the attacker's centre. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float HeightOffset = 0.f;

	// ---- Smash-style knockback ----
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float Damage = 3.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float BaseKnockback = 20.f;
	/** Knockback growth, Smash units (100 = normal scaling). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float KnockbackGrowth = 50.f;
	/** Launch elevation in degrees. 0 = flat, 90 = straight up, negative = spike down. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float LaunchAngle = 40.f;
	/** Multi-hit: this many hits spread across Active. All but the last use a small fixed knockback. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) int32 Hits = 1;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float HitstopScale = 1.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float ShakeScale = 1.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) EMoteFxType Fx = EMoteFxType::Slash;

	// ---- charge (Heavy only) ----
	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool bChargeable = false;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float MaxCharge = 1.0f;
	/** Damage/knockback multiplier at full charge (1 = no bonus). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float ChargeBonus = 1.4f;

	// ---- self motion ----
	/** Forward speed given at the start of Active (lunges, dashes). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float LungeSpeed = 0.f;
	/** Vertical speed given at the start of Active (+ rises, - plunges). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float VerticalSpeed = 0.f;
	/** Plunge: the move holds Active until the fighter lands, then hits a ring of LandingRadius. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool bPlungeUntilLanding = false;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float LandingRadius = 0.f;

	/** Reflects enemy projectiles while Active. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool bReflects = false;

	// ---- projectile / remote strike, emitted at the start of Active ----
	UPROPERTY(EditAnywhere, BlueprintReadOnly) EMoteProjectileKind Projectile = EMoteProjectileKind::None;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) int32 ProjectileCount = 1;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float ProjectileSpread = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float ProjectileSpeed = 2000.f;
	/** Launch pitch of the projectile in degrees (+ up, - down). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float ProjectilePitch = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float ProjectileLife = 1.2f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float ExplosionRadius = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool bProjectileReturns = false;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool bProjectilePierces = false;

	/** Sound played when the move goes active (without the "sfx_" prefix is fine too). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FName SwingSound = TEXT("sfx_swing_light");

	bool IsValid() const { return !Name.IsEmpty(); }
	float TotalTime() const { return Startup + Active + Recovery; }
};

/** How the weapon mesh is mounted: see UMoteAnimator for the pivot convention. */
USTRUCT(BlueprintType)
struct FMoteWeaponMount
{
	GENERATED_BODY()

	/** Longest dimension of the weapon once scaled, in cm. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float Length = 150.f;
	/** Extra rotation applied to the mesh after its long axis is aligned to +X. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FRotator ExtraRotation = FRotator::ZeroRotator;
	/**
	 * Where the grip sits along the long axis, as a fraction of Length measured
	 * from the centre: -0.5 is the -X end, +0.5 the +X end. The mesh is offset so
	 * the grip lands on the WeaponPivot origin and the blade/head points along +X.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float GripFraction = -0.38f;
	/** Flip the auto-detected long axis if the grip ends up at the wrong end. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool bFlipLongAxis = false;
};

/** A complete fighter: look, stats and moves. */
USTRUCT(BlueprintType)
struct FMoteFighterDef
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly) EMoteCore Core = EMoteCore::Blade;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString DisplayName;
	/** Short epithet for the select screen: "The Emerald Edge". */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString Epithet;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString Blurb;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FLinearColor Accent = FLinearColor::White;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FLinearColor Secondary = FLinearColor::Gray;

	// ---- stats ----
	/** Smash-scale weight: ~70 light, 100 average, ~125 heavy. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float Weight = 100.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float RunSpeed = 820.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float AirSpeed = 700.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float JumpVelocity = 1050.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float AirJumpVelocity = 950.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) int32 AirJumps = 2;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float GravityScale = 2.4f;
	/** Seconds of hover (hold Jump while falling) per airtime. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float HoverTime = 1.1f;

	// ---- look (asset object paths; empty = primitive fallback) ----
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString BodyMesh;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString GauntletMesh;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString WeaponMesh;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FString ProjectileMesh;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) EMoteWeaponHold Hold = EMoteWeaponHold::OneHandRight;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FMoteWeaponMount Mount;
	/** Body height in cm once scaled (the capsule is sized to match). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float BodyHeight = 130.f;
	/** Yaw correction so the body's visor faces +X after import. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float BodyYawOffset = 0.f;
	/** Gauntlet longest dimension in cm, and yaw so the knuckles face +X. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float GauntletSize = 44.f;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FRotator GauntletRotation = FRotator::ZeroRotator;

	/** Indexed by EMoteMoveSlot; always EMoteMoveSlot::Count entries. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) TArray<FMoteMoveDef> Moves;

	const FMoteMoveDef& GetMove(EMoteMoveSlot Slot) const { return Moves[static_cast<int32>(Slot)]; }
	FMoteMoveDef& EditMove(EMoteMoveSlot Slot) { return Moves[static_cast<int32>(Slot)]; }
};

/** Static roster table (MoteFighterData.cpp). */
class MOTERUMBLE_API FMoteRoster
{
public:
	static const FMoteFighterDef& Get(EMoteCore Core);
	static const TArray<FMoteFighterDef>& All();
	static int32 Num() { return static_cast<int32>(EMoteCore::Count); }
	/** Uniform random fighter, never Exclude (unless it is the only choice). */
	static EMoteCore RandomCore(EMoteCore Exclude = EMoteCore::Count);
	static EMoteCore FromName(const FString& Name, EMoteCore Fallback);
};

// ----------------------------------------------------------------------------
//  Hits
// ----------------------------------------------------------------------------

/** Everything needed to resolve one hit on one fighter. */
USTRUCT(BlueprintType)
struct FMoteHitInfo
{
	GENERATED_BODY()

	UPROPERTY() TObjectPtr<AMoteCharacter> Attacker = nullptr;
	/** Percent added to the victim. */
	UPROPERTY() float Damage = 0.f;
	UPROPERTY() float BaseKnockback = 0.f;
	UPROPERTY() float KnockbackGrowth = 0.f;
	/** If > 0, overrides the formula with this fixed knockback (multi-hit links). */
	UPROPERTY() float FixedKnockback = 0.f;
	UPROPERTY() float LaunchAngle = 40.f;
	/** Horizontal launch direction (normalised in XY). */
	UPROPERTY() FVector Direction = FVector::ForwardVector;
	UPROPERTY() FVector Location = FVector::ZeroVector;
	UPROPERTY() float HitstopScale = 1.f;
	UPROPERTY() float ShakeScale = 1.f;
	UPROPERTY() EMoteFxType Fx = EMoteFxType::Slash;
	/** Came from a projectile/explosion rather than the attacker's body. */
	UPROPERTY() bool bRanged = false;
};

UENUM()
enum class EMoteHitResult : uint8
{
	Ignored,   // Invulnerable, already KO'd, same team...
	Blocked,   // Shield took it
	Hit
};

// ----------------------------------------------------------------------------
//  Tuning shared by fighters, AI and camera.
// ----------------------------------------------------------------------------
namespace MoteTuning
{
	/** Smash launch speed conversion: knockback units -> cm/s. */
	constexpr float LaunchSpeedPerKB = 17.f;
	/** Horizontal speed bled off per second while launched. */
	constexpr float LaunchDrag = 1250.f;
	/** Hitstun seconds per knockback unit (Smash: 0.4 frames per unit). */
	constexpr float HitstunPerKB = 0.4f / 60.f;
	/** Knockback below this is a flinch: no tumble, short stun. */
	constexpr float TumbleThreshold = 80.f;

	constexpr float ShieldMax = 50.f;
	constexpr float ShieldDrainPerSec = 9.f;
	constexpr float ShieldRegenPerSec = 6.f;
	constexpr float ShieldBreakStun = 2.4f;

	constexpr float RespawnDelay = 1.4f;
	constexpr float RespawnHoldMax = 2.5f;
	constexpr float RespawnInvuln = 2.0f;
	constexpr int32 DefaultStocks = 3;
}
