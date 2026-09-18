// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "MotePlayerController.generated.h"

class AMoteCharacter;
class AMoteGameMode;

/**
 * Keyboard and gamepad input for Mote Rumble, polled every frame (no input
 * assets needed, and it keeps working while the game is paused). In menus it
 * drives the game mode's menu; in a fight it drives the possessed fighter's
 * button API, with movement made camera-relative.
 *
 *   Move        W A S D / arrows / left stick
 *   Jump        Space / A                (hold while falling = hover)
 *   Light       H / X                    (3-hit combo, air attack)
 *   Heavy       J / Y                    (hold to charge, release)
 *   Shield      K / either trigger       (+ direction tap = roll)
 *   Dodge       L / Left Shift / RB
 *   Pause       P / Escape / Start
 *   Confirm     Enter (Space and H also confirm in menus) / A
 *   Back        Backspace (K also backs out in menus) / B
 */
UCLASS()
class MOTERUMBLE_API AMotePlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	AMotePlayerController();

	virtual void PlayerTick(float DeltaTime) override;

protected:
	AMoteGameMode* GetMoteGameMode() const;
	AMoteCharacter* GetFighter() const;
	bool InFight() const;

	bool AnyPressed(std::initializer_list<FKey> Keys) const;
	bool AnyReleased(std::initializer_list<FKey> Keys) const;
	bool AnyDown(std::initializer_list<FKey> Keys) const;
	/** Raw stick/keys: X = right, Y = forward (away from camera). */
	FVector2D ReadDirection() const;

	void TickMenu(float DeltaTime, AMoteGameMode* GM);
	void TickFight(AMoteGameMode* GM);

	/** Menu auto-repeat for held directions. */
	FIntPoint HeldMenuDir = FIntPoint::ZeroValue;
	float MenuRepeatTimer = 0.f;
	/** Shield + a fresh direction = roll. */
	bool bDirWasNeutral = true;
};
