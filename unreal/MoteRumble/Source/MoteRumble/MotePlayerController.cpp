// Copyright Not Tim Games. All Rights Reserved.

#include "MotePlayerController.h"

#include "MoteCameraDirector.h"
#include "MoteCharacter.h"
#include "MoteGameMode.h"

#include "InputCoreTypes.h"

AMotePlayerController::AMotePlayerController()
{
	bShowMouseCursor = false;
	bAutoManageActiveCameraTarget = false;
	bShouldPerformFullTickWhenPaused = true;
	PrimaryActorTick.bTickEvenWhenPaused = true;
}

AMoteGameMode* AMotePlayerController::GetMoteGameMode() const
{
	return GetWorld() ? GetWorld()->GetAuthGameMode<AMoteGameMode>() : nullptr;
}

AMoteCharacter* AMotePlayerController::GetFighter() const
{
	return Cast<AMoteCharacter>(GetPawn());
}

bool AMotePlayerController::InFight() const
{
	const AMoteGameMode* GM = GetMoteGameMode();
	if (!GM)
	{
		return false;
	}
	switch (GM->GetPhase())
	{
	case EMoteMatchPhase::Intro:
	case EMoteMatchPhase::Countdown:
	case EMoteMatchPhase::Fight:
	case EMoteMatchPhase::GameSet:
		return true;
	default:
		return false;
	}
}

bool AMotePlayerController::AnyPressed(std::initializer_list<FKey> Keys) const
{
	for (const FKey& K : Keys)
	{
		if (WasInputKeyJustPressed(K)) { return true; }
	}
	return false;
}

bool AMotePlayerController::AnyReleased(std::initializer_list<FKey> Keys) const
{
	for (const FKey& K : Keys)
	{
		if (WasInputKeyJustReleased(K)) { return true; }
	}
	return false;
}

bool AMotePlayerController::AnyDown(std::initializer_list<FKey> Keys) const
{
	for (const FKey& K : Keys)
	{
		if (IsInputKeyDown(K)) { return true; }
	}
	return false;
}

FVector2D AMotePlayerController::ReadDirection() const
{
	FVector2D Dir = FVector2D::ZeroVector;
	if (AnyDown({ EKeys::W, EKeys::Up }))    { Dir.Y += 1.f; }
	if (AnyDown({ EKeys::S, EKeys::Down }))  { Dir.Y -= 1.f; }
	if (AnyDown({ EKeys::D, EKeys::Right })) { Dir.X += 1.f; }
	if (AnyDown({ EKeys::A, EKeys::Left }))  { Dir.X -= 1.f; }
	if (AnyDown({ EKeys::Gamepad_DPad_Up }))    { Dir.Y += 1.f; }
	if (AnyDown({ EKeys::Gamepad_DPad_Down }))  { Dir.Y -= 1.f; }
	if (AnyDown({ EKeys::Gamepad_DPad_Right })) { Dir.X += 1.f; }
	if (AnyDown({ EKeys::Gamepad_DPad_Left }))  { Dir.X -= 1.f; }

	const FVector2D Stick(GetInputAnalogKeyState(EKeys::Gamepad_LeftX), GetInputAnalogKeyState(EKeys::Gamepad_LeftY));
	if (Stick.Size() > 0.25f)
	{
		Dir += Stick;
	}
	return Dir.GetClampedToMaxSize(1.f);
}

void AMotePlayerController::PlayerTick(float DeltaTime)
{
	Super::PlayerTick(DeltaTime);

	AMoteGameMode* GM = GetMoteGameMode();
	if (!GM)
	{
		return;
	}

	// Pause works from anywhere in a match.
	if (AnyPressed({ EKeys::P, EKeys::Gamepad_Special_Right }) && InFight())
	{
		GM->TogglePause();
	}
	else if (WasInputKeyJustPressed(EKeys::Escape))
	{
		if (InFight() || GM->IsPauseMenuOpen())
		{
			GM->TogglePause();
		}
		else
		{
			GM->MenuBack();
		}
	}

	if (GM->IsPauseMenuOpen() || !InFight())
	{
		if (AMoteCharacter* F = GetFighter())
		{
			F->SetMoveInput(FVector2D::ZeroVector);
		}
		TickMenu(DeltaTime, GM);
	}
	else
	{
		TickFight(GM);
	}
}

void AMotePlayerController::TickMenu(float DeltaTime, AMoteGameMode* GM)
{
	const FVector2D Raw = ReadDirection();
	FIntPoint Dir(0, 0);
	if (FMath::Abs(Raw.X) > 0.5f) { Dir.X = Raw.X > 0.f ? 1 : -1; }
	if (FMath::Abs(Raw.Y) > 0.5f) { Dir.Y = Raw.Y > 0.f ? -1 : 1; }  // menus: down = +1

	if (Dir != HeldMenuDir)
	{
		HeldMenuDir = Dir;
		if (Dir != FIntPoint::ZeroValue)
		{
			GM->MenuNavigate(Dir.X, Dir.Y);
			MenuRepeatTimer = 0.38f;
		}
	}
	else if (Dir != FIntPoint::ZeroValue)
	{
		MenuRepeatTimer -= DeltaTime;
		if (MenuRepeatTimer <= 0.f)
		{
			GM->MenuNavigate(Dir.X, Dir.Y);
			MenuRepeatTimer = 0.13f;
		}
	}

	if (AnyPressed({ EKeys::Enter, EKeys::SpaceBar, EKeys::H, EKeys::Gamepad_FaceButton_Bottom }))
	{
		GM->MenuConfirm();
	}
	else if (AnyPressed({ EKeys::BackSpace, EKeys::K, EKeys::Gamepad_FaceButton_Right }))
	{
		GM->MenuBack();
	}
}

void AMotePlayerController::TickFight(AMoteGameMode* GM)
{
	AMoteCharacter* F = GetFighter();
	if (!F)
	{
		return;
	}

	// Camera-relative movement.
	const FVector2D Raw = ReadDirection();
	const float Yaw = GM->GetCameraDirector() ? GM->GetCameraDirector()->GetViewYaw() : 0.f;
	const float Rad = FMath::DegreesToRadians(Yaw);
	const FVector2D Fwd(FMath::Cos(Rad), FMath::Sin(Rad));
	const FVector2D Right(-FMath::Sin(Rad), FMath::Cos(Rad));
	const FVector2D World = Fwd * Raw.Y + Right * Raw.X;
	F->SetMoveInput(World);

	// Jump / hover.
	if (AnyPressed({ EKeys::SpaceBar, EKeys::Gamepad_FaceButton_Bottom }))
	{
		F->PressJump();
	}
	F->SetJumpHeld(AnyDown({ EKeys::SpaceBar, EKeys::Gamepad_FaceButton_Bottom }));

	// Attacks.
	if (AnyPressed({ EKeys::H, EKeys::Gamepad_FaceButton_Left }))
	{
		F->PressLight();
	}
	if (AnyPressed({ EKeys::J, EKeys::Gamepad_FaceButton_Top }))
	{
		F->PressHeavy();
	}
	// Level state, not an edge. Heavy was the only button read as a key-up, and
	// while the pause menu is open this function never runs - so a release during
	// pause was lost, the charge latched, and on unpause the fighter fired a fully
	// charged signature at whatever it was facing. Jump and shield already work
	// this way and self-correct for the same reason.
	if (!AnyDown({ EKeys::J, EKeys::Gamepad_FaceButton_Top }))
	{
		F->ReleaseHeavy();
	}

	// Shield, and shield + a fresh direction = roll.
	const bool bShield = AnyDown({ EKeys::K, EKeys::Gamepad_RightTrigger, EKeys::Gamepad_LeftTrigger })
		|| GetInputAnalogKeyState(EKeys::Gamepad_RightTriggerAxis) > 0.4f;
	F->SetShieldHeld(bShield);
	const bool bNeutral = Raw.Size() < 0.5f;
	if (bShield && bDirWasNeutral && !bNeutral && F->IsShielding())
	{
		F->PressDodge();
	}
	bDirWasNeutral = bNeutral;

	if (AnyPressed({ EKeys::L, EKeys::LeftShift, EKeys::Gamepad_RightShoulder }))
	{
		F->PressDodge();
	}
}
