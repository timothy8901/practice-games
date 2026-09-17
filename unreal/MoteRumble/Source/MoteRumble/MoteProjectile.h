// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MoteTypes.h"
#include "MoteProjectile.generated.h"

class USphereComponent;
class UStaticMeshComponent;
class UProjectileMovementComponent;
class AMoteCharacter;

/**
 * Everything a Core throws: bolts, discs, and lobbed cinders.
 * Behaviour (piercing / returning / exploding) is driven by the FMoteAttackDef
 * it was launched with, so one actor covers all eight Cores.
 */
UCLASS()
class MOTERUMBLE_API AMoteProjectile : public AActor
{
	GENERATED_BODY()

public:
	AMoteProjectile();

	/** Configure and launch. Call immediately after spawning. */
	void Launch(AMoteCharacter* InOwnerMote, const FMoteAttackDef& InAttack,
		const FLinearColor& InColor, const FVector& Direction);

	/** Flip ownership and reverse course (used by Veil's reflecting spin). */
	void Reflect(AMoteCharacter* NewOwnerMote);

	AMoteCharacter* GetOwnerMote() const { return OwnerMote.Get(); }

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	UFUNCTION()
	void OnOverlap(UPrimitiveComponent* OverlappedComp, AActor* OtherActor,
		UPrimitiveComponent* OtherComp, int32 OtherBodyIndex,
		bool bFromSweep, const FHitResult& Sweep);

	/** Radial damage + destroy, for Lob shapes. */
	void Detonate();

	UPROPERTY(VisibleAnywhere, Category = "Mote")
	TObjectPtr<USphereComponent> Collision;

	UPROPERTY(VisibleAnywhere, Category = "Mote")
	TObjectPtr<UStaticMeshComponent> Mesh;

	UPROPERTY(VisibleAnywhere, Category = "Mote")
	TObjectPtr<UProjectileMovementComponent> Movement;

private:
	UPROPERTY()
	TWeakObjectPtr<AMoteCharacter> OwnerMote;

	FMoteAttackDef Attack;
	FLinearColor Color = FLinearColor::White;

	/** Targets already damaged, so piercing shots never double-hit. */
	UPROPERTY()
	TSet<TWeakObjectPtr<AActor>> HitActors;

	float Age = 0.f;
	bool bReturning = false;
	float SpinRate = 0.f;
};
