// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Controller.h"
#include "MoteAIController.generated.h"

class AMoteCharacter;

/**
 * Rival Mote brain.
 *
 * Deliberately a plain AController with direct steering rather than an
 * AAIController + behaviour tree: the arena is a flat disc and there is no
 * baked navmesh, so pathfinding would buy nothing and cost a dependency.
 * Keeps a preferred range based on whether its Core is melee or ranged,
 * strafes, and shields reactively.
 */
UCLASS()
class MOTERUMBLE_API AMoteAIController : public AController
{
	GENERATED_BODY()

public:
	AMoteAIController();

	virtual void Tick(float DeltaSeconds) override;

protected:
	/** The Mote this brain is fighting. Resolved lazily. */
	UPROPERTY()
	TWeakObjectPtr<AMoteCharacter> Target;

	/** Refresh Target if it went missing. */
	AMoteCharacter* FindTarget();

	/** Seconds until the next decision. */
	float ThinkTimer = 0.f;

	/** Gate so it doesn't chain attacks instantly. */
	float AttackCooldown = 0.8f;

	/** Seconds left holding the shield. */
	float ShieldTimer = 0.f;

	/** +1 / -1 orbit direction, flipped occasionally. */
	float StrafeDir = 1.f;
};
