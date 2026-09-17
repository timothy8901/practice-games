// Copyright Not Tim Games. All Rights Reserved.

#include "MoteGameMode.h"

#include "MoteArena.h"
#include "MoteCharacter.h"
#include "MoteAIController.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"

AMoteGameMode::AMoteGameMode()
{
	PrimaryActorTick.bCanEverTick = true;
	DefaultPawnClass = AMoteCharacter::StaticClass();
	PlayerControllerClass = APlayerController::StaticClass();
}

void AMoteGameMode::StartPlay()
{
	// The floor has to exist before the default pawn spawns, otherwise the
	// player drops straight through an empty level.
	SpawnArena();

	Super::StartPlay();

	BeginRound();
}

void AMoteGameMode::SpawnArena()
{
	UWorld* World = GetWorld();
	if (!World || Arena)
	{
		return;
	}

	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	Arena = World->SpawnActor<AMoteArena>(AMoteArena::StaticClass(),
		FVector::ZeroVector, FRotator::ZeroRotator, Params);
}

void AMoteGameMode::BeginRound()
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	const float Radius = Arena ? Arena->GetArenaRadius() : 1750.f;
	const float StartOffset = Radius * 0.45f;
	const FVector PlayerSpot(-StartOffset, 0.f, 200.f);
	const FVector RivalSpot(StartOffset, 0.f, 200.f);

	// ---- the player's Mote ----
	APlayerController* PC = World->GetFirstPlayerController();
	AMoteCharacter* PlayerMote = PC ? Cast<AMoteCharacter>(PC->GetPawn()) : nullptr;
	if (PlayerMote)
	{
		PlayerMote->SetActorLocation(PlayerSpot, false, nullptr, ETeleportType::TeleportPhysics);
		PlayerMote->SetActorRotation(FRotator(0.f, 0.f, 0.f));
		PlayerMote->EquipCore(PlayerStartingCore);
		PlayerMote->ResetForRound();
	}

	// ---- the rival ----
	if (!RivalMote)
	{
		FActorSpawnParameters Params;
		Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		RivalMote = World->SpawnActor<AMoteCharacter>(AMoteCharacter::StaticClass(),
			RivalSpot, FRotator(0.f, 180.f, 0.f), Params);

		if (RivalMote)
		{
			// No camera on the rival, and a cooler body so the two read apart
			// instantly at a glance.
			RivalMote->SetWantsCamera(false);
			RivalMote->SetBodyColor(FLinearColor(0.62f, 0.70f, 0.80f));

			AMoteAIController* Brain = World->SpawnActor<AMoteAIController>(
				AMoteAIController::StaticClass());
			if (Brain)
			{
				Brain->Possess(RivalMote);
			}
		}
	}

	if (RivalMote)
	{
		RivalMote->SetActorLocation(RivalSpot, false, nullptr, ETeleportType::TeleportPhysics);
		RivalMote->SetActorRotation(FRotator(0.f, 180.f, 0.f));
		// Fresh Core each round, never a mirror of the player's.
		const EMoteCore PlayerCore = PlayerMote ? PlayerMote->GetCore() : PlayerStartingCore;
		RivalMote->EquipCore(FMoteCoreLibrary::RandomCore(PlayerCore));
		RivalMote->ResetForRound();
	}

	bRoundOver = false;
	RematchTimer = 0.f;
}

void AMoteGameMode::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (bRoundOver)
	{
		RematchTimer -= DeltaSeconds;
		if (RematchTimer <= 0.f)
		{
			BeginRound();
		}
		return;
	}

	// Round ends the moment either Mote is downed.
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	for (TActorIterator<AMoteCharacter> It(World); It; ++It)
	{
		const AMoteCharacter* Mote = *It;
		if (Mote && Mote->IsDowned())
		{
			bRoundOver = true;
			RematchTimer = RematchDelay;
			break;
		}
	}
}
