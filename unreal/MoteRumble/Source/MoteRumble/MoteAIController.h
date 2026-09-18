// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Controller.h"
#include "MoteAIController.generated.h"

class AMoteCharacter;

/**
 * CPU opponent. Drives its AMoteCharacter purely through the fighter's button
 * API (SetMoveInput / PressJump / SetJumpHeld / PressLight / PressHeavy /
 * ReleaseHeavy / SetShieldHeld / PressDodge), exactly like a human would, so it
 * can never do anything a player can't.
 *
 * Behaviour, scaled by Level (1 = sleepy, 9 = sharp):
 *   - RECOVERY FIRST: when off the platform, steer back toward the centre using
 *     air jumps, hover (hold jump) and a directional air dodge at the right time.
 *     Never throw away a stock through carelessness above level 3.
 *   - Neutral: approach/space to the current fighter's preferred range (melee vs
 *     projectile fighters), strafe, feint, jump in.
 *   - Offence: jab strings, finishers, charged heavies when the target is high
 *     percent or stunned, punish whiffs and shield breaks.
 *   - Defence: react to an opponent's move startup with shield or dodge
 *     (probability and reaction time from Level), don't shield forever.
 *   - Edge-guard: harass an opponent recovering from off-stage with projectiles
 *     or aerials, without following them too far out.
 * Reaction delays are real: it decides on a ~0.1-0.35 s think tick (faster at
 * higher Level) and keeps a small input buffer so it looks human.
 */
UCLASS()
class MOTERUMBLE_API AMoteAIController : public AController
{
	GENERATED_BODY()

public:
	AMoteAIController();

	virtual void Tick(float DeltaSeconds) override;

	void SetLevel(int32 InLevel) { Level = FMath::Clamp(InLevel, 1, 9); }
	int32 GetLevel() const { return Level; }

protected:
	virtual void OnPossess(APawn* InPawn) override;
	virtual void OnUnPossess() override;

	AMoteCharacter* GetFighter() const;

	int32 Level = 5;

	// Implementation state is up to the implementer.
};
