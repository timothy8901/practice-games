// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "MoteTypes.h"
#include "MoteGameMode.generated.h"

class AMoteArena;
class AMoteCharacter;

/**
 * One-on-one duel: the player's Mote against a rival with a random Core.
 *
 * Builds the arena before any pawn spawns so the match works in a completely
 * empty level, then runs a simple round loop - fight, someone goes down,
 * short beat, rematch with a freshly rolled rival Core.
 */
UCLASS()
class MOTERUMBLE_API AMoteGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AMoteGameMode();

	virtual void StartPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	/** Seconds between a knockout and the next round. */
	UPROPERTY(EditAnywhere, Category = "Match")
	float RematchDelay = 3.0f;

	/** Core the player starts with. */
	UPROPERTY(EditAnywhere, Category = "Match")
	EMoteCore PlayerStartingCore = EMoteCore::Blade;

protected:
	/** Creates the platform. Called before pawns exist. */
	void SpawnArena();

	/** Positions the player and spawns the rival. */
	void BeginRound();

	UPROPERTY()
	TObjectPtr<AMoteArena> Arena;

	UPROPERTY()
	TObjectPtr<AMoteCharacter> RivalMote;

private:
	float RematchTimer = 0.f;
	bool bRoundOver = false;
};
