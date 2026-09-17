// Copyright Not Tim Games. All Rights Reserved.
//
// Core data definitions for Mote Rumble.
// A "Core" is a power a Mote absorbs; each grants two attacks. Shielding is
// universal and lives on the Mote itself, not the Core.

#pragma once

#include "CoreMinimal.h"
#include "MoteTypes.generated.h"

/** The eight absorbable Cores. */
UENUM(BlueprintType)
enum class EMoteCore : uint8
{
	Blade	UMETA(DisplayName = "Blade"),
	Arc		UMETA(DisplayName = "Arc"),
	Disc	UMETA(DisplayName = "Disc"),
	Maul	UMETA(DisplayName = "Maul"),
	Bow		UMETA(DisplayName = "Bow"),
	Flare	UMETA(DisplayName = "Flare"),
	Cinder	UMETA(DisplayName = "Cinder"),
	Veil	UMETA(DisplayName = "Veil"),
	Count	UMETA(Hidden)
};

/** How an attack resolves in the world. */
UENUM(BlueprintType)
enum class EMoteAttackShape : uint8
{
	/** Cone sweep in front of the Mote. */
	MeleeArc	UMETA(DisplayName = "Melee Arc"),
	/** Full 360 sweep around the Mote. */
	Spin		UMETA(DisplayName = "Spin"),
	/** Straight-flying projectile. */
	Projectile	UMETA(DisplayName = "Projectile"),
	/** Arcing projectile that detonates in a radius. */
	Lob			UMETA(DisplayName = "Lob"),
	/** Instant radial burst centred on the Mote. */
	Slam		UMETA(DisplayName = "Slam"),
	/** Lunge forward, damaging whatever it touches. */
	Dash		UMETA(DisplayName = "Dash")
};

/** A single attack (each Core has a primary and a special). */
USTRUCT(BlueprintType)
struct FMoteAttackDef
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack")
	FName DisplayName = NAME_None;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack")
	EMoteAttackShape Shape = EMoteAttackShape::MeleeArc;

	/** Damage in hearts. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack")
	float Damage = 1.0f;

	/** Reach for melee shapes, or burst radius for Slam. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack")
	float Range = 260.0f;

	/** Half-angle tolerance for MeleeArc, in degrees. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack")
	float ArcDegrees = 110.0f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack")
	float Knockback = 700.0f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack")
	float Cooldown = 0.5f;

	/** Seconds from input to the damage frame. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack")
	float WindUp = 0.14f;

	/** Total seconds the Mote is locked in the attack. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack")
	float Duration = 0.36f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Projectile")
	float ProjectileSpeed = 1800.0f;

	/** Detonation radius for Lob, and blast radius for exploding hits. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Projectile")
	float AoERadius = 0.0f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Projectile")
	int32 ProjectileCount = 1;

	/** Total fan width when ProjectileCount > 1, in degrees. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Projectile")
	float SpreadDegrees = 0.0f;

	/** Passes through targets instead of being consumed. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Projectile")
	bool bPiercing = false;

	/** Boomerangs back to the thrower. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Projectile")
	bool bReturns = false;

	/** Grants a window that bats away incoming projectiles. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack")
	bool bReflects = false;

	/** Distance travelled by a Dash. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Attack")
	float DashDistance = 700.0f;
};

/** One Core: identity, colour, and its two attacks. */
USTRUCT(BlueprintType)
struct FMoteCoreDef
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Core")
	EMoteCore Core = EMoteCore::Blade;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Core")
	FName DisplayName = NAME_None;

	/** Drives the chest crystal, the hand glow, and projectile tint. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Core")
	FLinearColor Color = FLinearColor::White;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Core")
	FMoteAttackDef Primary;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Core")
	FMoteAttackDef Special;
};

/** Which of a Core's two attacks is being used. */
UENUM(BlueprintType)
enum class EMoteAttackSlot : uint8
{
	Primary,
	Special
};

/** Static table of all eight Cores. Defined once in MoteCoreLibrary.cpp. */
class MOTERUMBLE_API FMoteCoreLibrary
{
public:
	/** Full definition for a Core, including both attacks. */
	static const FMoteCoreDef& Get(EMoteCore Core);

	/** Convenience: fetch one attack slot directly. */
	static const FMoteAttackDef& GetAttack(EMoteCore Core, EMoteAttackSlot Slot);

	/** All eight, in display order. */
	static const TArray<FMoteCoreDef>& All();

	/** Uniformly random Core, optionally excluding one (for picking a rival). */
	static EMoteCore RandomCore(EMoteCore Exclude = EMoteCore::Count);
};
