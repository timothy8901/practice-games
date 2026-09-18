// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MoteTypes.h"
#include "MoteProjectile.generated.h"

class USphereComponent;
class UStaticMeshComponent;
class UPointLightComponent;
class AMoteCharacter;

/**
 * Arrows, chakrams, bombs, energy bolts, fireballs - and the Lightning strike,
 * which is a stationary telegraph that detonates after a short delay.
 * Movement is integrated by hand (no ProjectileMovementComponent) so bombs can
 * arc/bounce and discs can boomerang exactly as designed.
 */
UCLASS()
class MOTERUMBLE_API AMoteProjectile : public AActor
{
	GENERATED_BODY()

public:
	AMoteProjectile();

	virtual void Tick(float DeltaSeconds) override;

	/**
	 * Arm and launch. Direction is the full 3D launch direction; ChargeScale
	 * multiplies damage/knockback (1 = uncharged).
	 */
	void Launch(AMoteCharacter* InOwner, const FMoteMoveDef& InMove, const FVector& Direction,
		float Speed, float InChargeScale, UStaticMesh* InMesh, float MeshSize, const FLinearColor& InColor);

	/** Turn around and belong to NewOwner. */
	void Reflect(AMoteCharacter* NewOwner);

	AMoteCharacter* GetOwnerMote() const { return OwnerMote.Get(); }
	bool IsReflectable() const { return Kind != EMoteProjectileKind::Lightning; }
	/** A thrown weapon that flies back to its owner (Disc's chakram). */
	bool IsReturningWeapon() const { return Move.bProjectileReturns; }
	EMoteProjectileKind GetKind() const { return Kind; }
	FVector GetVelocity3D() const { return Velocity; }

protected:
	void HitFighter(AMoteCharacter* Target);
	void Detonate();
	void CheckFighterOverlaps();

	UPROPERTY(VisibleAnywhere) TObjectPtr<USphereComponent> Collision;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UStaticMeshComponent> Mesh;
	UPROPERTY(VisibleAnywhere) TObjectPtr<UPointLightComponent> Glow;

	TWeakObjectPtr<AMoteCharacter> OwnerMote;
	FMoteMoveDef Move;
	EMoteProjectileKind Kind = EMoteProjectileKind::EnergyBolt;
	FLinearColor Color = FLinearColor::White;
	FVector Velocity = FVector::ZeroVector;
	float ChargeScale = 1.f;
	float Age = 0.f;
	float Life = 1.f;
	float TrailTimer = 0.f;
	bool bReturning = false;
	bool bDetonated = false;
	int32 Bounces = 0;
	TArray<TWeakObjectPtr<AMoteCharacter>> AlreadyHit;
};
