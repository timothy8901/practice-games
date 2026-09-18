// Copyright Not Tim Games. All Rights Reserved.
// STUB - replaced by the full VFX implementation.

#include "MoteFX.h"
#include "ProceduralMeshComponent.h"
#include "Engine/World.h"

UMoteFX* UMoteFX::Get(const UObject* WorldContext)
{
	const UWorld* World = WorldContext ? WorldContext->GetWorld() : nullptr;
	return World ? World->GetSubsystem<UMoteFX>() : nullptr;
}

void UMoteFX::HitSpark(const FVector&, const FVector&, EMoteFxType, const FLinearColor&, float) {}
void UMoteFX::BlockSpark(const FVector&, const FLinearColor&) {}
void UMoteFX::SlashArc(const FVector&, const FRotator&, float, float, const FLinearColor&, bool, float) {}
void UMoteFX::Shockwave(const FVector&, float, const FLinearColor&, float) {}
void UMoteFX::Explosion(const FVector&, float) {}
void UMoteFX::LightningWarning(const FVector&, float, float, const FLinearColor&) {}
void UMoteFX::Lightning(const FVector&, float, const FLinearColor&) {}
void UMoteFX::FireBurst(const FVector&, const FVector&, float) {}
void UMoteFX::ChargeSparkle(const FVector&, const FLinearColor&, float) {}
void UMoteFX::ChargeReady(const FVector&, const FLinearColor&) {}
void UMoteFX::ShieldBreak(const FVector&, const FLinearColor&) {}
void UMoteFX::Reflect(const FVector&, const FLinearColor&) {}
void UMoteFX::Dust(const FVector&, float) {}
void UMoteFX::JumpPuff(const FVector&, const FLinearColor&, bool) {}
void UMoteFX::LaunchSmoke(const FVector&, const FVector&, float) {}
void UMoteFX::DashStreak(const FVector&, const FVector&, const FLinearColor&) {}
void UMoteFX::KOBlast(const FVector&, const FVector&, const FLinearColor&) {}
void UMoteFX::RespawnBeam(const FVector&, const FLinearColor&) {}
void UMoteFX::ProjectileTrail(const FVector&, const FLinearColor&, float) {}
void UMoteFX::Tick(float) {}
TStatId UMoteFX::GetStatId() const { RETURN_QUICK_DECLARE_CYCLE_STAT(UMoteFX, STATGROUP_Tickables); }

UMoteWeaponTrail::UMoteWeaponTrail()
{
	PrimaryComponentTick.bCanEverTick = false;
}
void UMoteWeaponTrail::SetColor(const FLinearColor& InColor) { Color = InColor; }
void UMoteWeaponTrail::AddSample(const FVector&, const FVector&) {}
void UMoteWeaponTrail::SetEmitting(bool bInEmitting) { bEmitting = bInEmitting; }
void UMoteWeaponTrail::Clear() {}
void UMoteWeaponTrail::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
}
void UMoteWeaponTrail::OnRegister() { Super::OnRegister(); }
