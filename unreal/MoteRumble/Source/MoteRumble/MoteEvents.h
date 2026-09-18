// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "MoteTypes.h"
#include "MoteEvents.generated.h"

class AMoteCharacter;

/** A resolved hit, broadcast after the victim has taken it. */
struct FMoteHitEvent
{
	TWeakObjectPtr<AMoteCharacter> Attacker;
	TWeakObjectPtr<AMoteCharacter> Victim;
	float Damage = 0.f;
	/** Knockback units actually applied (0 when blocked). */
	float Knockback = 0.f;
	FVector Location = FVector::ZeroVector;
	FVector LaunchVelocity = FVector::ZeroVector;
	EMoteFxType Fx = EMoteFxType::Slash;
	bool bBlocked = false;
	/** Knockback past the tumble threshold - worth a bigger reaction. */
	bool bStrong = false;
	/** Predicted to carry the victim out of the blast zone. */
	bool bLethal = false;
};

/** A fighter crossed a blast zone. */
struct FMoteKOEvent
{
	TWeakObjectPtr<AMoteCharacter> Victim;
	TWeakObjectPtr<AMoteCharacter> LastAttacker;
	FVector Location = FVector::ZeroVector;
	/** Unit vector from the KO point back toward the arena centre. */
	FVector InwardDirection = FVector::ZeroVector;
	int32 StocksLeft = 0;
	/** This KO ends the match. */
	bool bFinal = false;
};

/** Big centre-screen text ("READY?", "GO!", "GAME!"). */
struct FMoteAnnouncement
{
	FString Text;
	FLinearColor Color = FLinearColor::White;
	float Duration = 1.2f;
	/** 0 small, 1 normal, 2 huge. */
	int32 Size = 1;
};

DECLARE_MULTICAST_DELEGATE_OneParam(FOnMoteHit, const FMoteHitEvent&);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnMoteKO, const FMoteKOEvent&);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnMoteAnnounce, const FMoteAnnouncement&);
DECLARE_MULTICAST_DELEGATE_TwoParams(FOnMoteScreenFlash, const FLinearColor& /*Color*/, float /*Duration*/);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnMoteFighterEvent, AMoteCharacter*);
DECLARE_MULTICAST_DELEGATE_TwoParams(FOnMoteImpact, const FVector& /*Location*/, float /*Strength 0..2*/);

/**
 * Loose coupling between gameplay and presentation. Fighters and the game mode
 * broadcast here; the HUD, camera, audio and FX listen. Nothing presentation-side
 * ever needs to be known by gameplay code.
 */
UCLASS()
class MOTERUMBLE_API UMoteEventHub : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	static UMoteEventHub* Get(const UObject* WorldContext);

	FOnMoteHit OnHit;
	FOnMoteKO OnKO;
	FOnMoteAnnounce OnAnnounce;
	FOnMoteScreenFlash OnScreenFlash;
	/** A fighter spawned onto the respawn halo. */
	FOnMoteFighterEvent OnRespawn;
	/** A fighter's shield shattered. */
	FOnMoteFighterEvent OnShieldBreak;
	/** Something heavy hit the world (slams, explosions, lightning) - camera shake. */
	FOnMoteImpact OnImpact;

	void Announce(const FString& Text, const FLinearColor& Color, float Duration = 1.2f, int32 Size = 1);
	void Flash(const FLinearColor& Color, float Duration);
	void Impact(const FVector& Location, float Strength) { OnImpact.Broadcast(Location, Strength); }
};
