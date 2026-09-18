// Copyright Not Tim Games. All Rights Reserved.
// STUB - replaced by the full camera implementation.

#include "MoteCameraDirector.h"
#include "Camera/CameraComponent.h"
#include "MoteEvents.h"

AMoteCameraDirector::AMoteCameraDirector()
{
	PrimaryActorTick.bCanEverTick = true;
	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	RootComponent = Camera;
	Camera->SetFieldOfView(50.f);
}

void AMoteCameraDirector::BeginPlay()
{
	Super::BeginPlay();
	SetActorLocationAndRotation(FVector(-3400.f, 0.f, 2100.f), FRotator(-32.f, 0.f, 0.f));
}

void AMoteCameraDirector::EndPlay(const EEndPlayReason::Type Reason) { Super::EndPlay(Reason); }
void AMoteCameraDirector::Tick(float DeltaSeconds) { Super::Tick(DeltaSeconds); }
void AMoteCameraDirector::SetMode(EMoteCamMode NewMode, AActor* InFocus) { Mode = NewMode; Focus = InFocus; ModeTime = 0.f; }
void AMoteCameraDirector::AddTrauma(float Amount) { Trauma = FMath::Clamp(Trauma + Amount, 0.f, 1.f); }
void AMoteCameraDirector::Kick(const FVector&, float) {}
float AMoteCameraDirector::GetViewYaw() const { return 0.f; }
void AMoteCameraDirector::OnHit(const FMoteHitEvent&) {}
void AMoteCameraDirector::OnKO(const FMoteKOEvent&) {}
