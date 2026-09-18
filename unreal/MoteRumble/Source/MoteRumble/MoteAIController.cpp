// Copyright Not Tim Games. All Rights Reserved.
// STUB - replaced by the full CPU implementation.

#include "MoteAIController.h"
#include "MoteArena.h"
#include "MoteCharacter.h"
#include "MoteGameMode.h"

AMoteAIController::AMoteAIController()
{
	PrimaryActorTick.bCanEverTick = true;
	bWantsPlayerState = false;
}

void AMoteAIController::OnPossess(APawn* InPawn) { Super::OnPossess(InPawn); }
void AMoteAIController::OnUnPossess() { Super::OnUnPossess(); }

AMoteCharacter* AMoteAIController::GetFighter() const { return Cast<AMoteCharacter>(GetPawn()); }

void AMoteAIController::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	AMoteCharacter* Me = GetFighter();
	AMoteGameMode* GM = GetWorld()->GetAuthGameMode<AMoteGameMode>();
	if (!Me || !GM)
	{
		return;
	}
	TArray<AMoteCharacter*> Foes;
	GM->GetOpponents(Me, Foes);
	FVector2D Move = FVector2D::ZeroVector;
	const bool bOff = GM->GetArena() && !GM->GetArena()->IsOverPlatform(Me->GetActorLocation(), -100.f);
	if (bOff)
	{
		const FVector ToCenter = -Me->GetActorLocation();
		Move = FVector2D(ToCenter.X, ToCenter.Y).GetSafeNormal();
		if (Me->GetActorLocation().Z < 0.f) { Me->PressJump(); }
		Me->SetJumpHeld(true);
	}
	else if (Foes.Num() > 0)
	{
		const FVector To = Foes[0]->GetActorLocation() - Me->GetActorLocation();
		Move = FVector2D(To.X, To.Y).GetSafeNormal();
		if (To.Size2D() < 230.f)
		{
			Move = FVector2D::ZeroVector;
			if (FMath::FRand() < 0.1f) { Me->PressLight(); }
			if (FMath::FRand() < 0.02f) { Me->PressHeavy(); Me->ReleaseHeavy(); }
		}
		Me->SetJumpHeld(false);
	}
	Me->SetMoveInput(Move);
}
