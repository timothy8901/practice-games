// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "MoteTypes.h"
#include "MoteCharacter.generated.h"

class USpringArmComponent;
class UCameraComponent;
class UStaticMeshComponent;
class UPointLightComponent;
class UMaterialInstanceDynamic;
class UInputAction;
class UInputMappingContext;
struct FInputActionValue;

/** What the Mote is currently doing. Gates input. */
UENUM(BlueprintType)
enum class EMoteState : uint8
{
	Idle,
	Attacking,
	Hurt,
	Downed
};

/**
 * A Mote: a small floating spirit that absorbs a Core and duels in the arena.
 *
 * Built entirely from engine primitives so the game runs with zero authored
 * assets - a teardrop body, two detached orb hands, a visor eye, and a chest
 * crystal that takes on the colour of the equipped Core. It hovers rather than
 * walks, which is both the silhouette and the reason there are no foot bones
 * to animate.
 */
UCLASS()
class MOTERUMBLE_API AMoteCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AMoteCharacter();

	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(class UInputComponent* PlayerInputComponent) override;

	// ---- Loadout -----------------------------------------------------------

	/** Equip a Core: recolours the crystal/hands and swaps the moveset. */
	UFUNCTION(BlueprintCallable, Category = "Mote")
	void EquipCore(EMoteCore NewCore);

	UFUNCTION(BlueprintPure, Category = "Mote")
	EMoteCore GetCore() const { return CurrentCore; }

	// ---- Combat ------------------------------------------------------------

	/** Take a hit. Respects shield, i-frames, and applies knockback. */
	void ReceiveHit(float Damage, const FVector& Direction, float Knockback, AMoteCharacter* Attacker);

	UFUNCTION(BlueprintPure, Category = "Mote")
	float GetHealth() const { return Health; }

	UFUNCTION(BlueprintPure, Category = "Mote")
	float GetMaxHealth() const { return MaxHealth; }

	UFUNCTION(BlueprintPure, Category = "Mote")
	bool IsDowned() const { return State == EMoteState::Downed; }

	UFUNCTION(BlueprintPure, Category = "Mote")
	float GetShieldStamina() const { return ShieldStamina; }

	UFUNCTION(BlueprintPure, Category = "Mote")
	bool IsShielding() const { return bShielding; }

	/** Fraction of the cooldown remaining, 0 = ready. For HUD/AI. */
	float GetCooldownRemaining(EMoteAttackSlot Slot) const;

	/** Reset to full health and a clean state (round start). */
	void ResetForRound();

	// ---- Presentation setup (used by the GameMode when building a rival) ----

	/** Rival Motes suppress their camera so it can't steal the view target. */
	void SetWantsCamera(bool bWants);

	/** Recolours the body shell; the Core still drives hands and crystal. */
	void SetBodyColor(const FLinearColor& InColor);

	// ---- Driven by the player input or the AI controller --------------------

	/** Desired world-space move direction; length clamped to 1. */
	void SetMoveIntent(const FVector2D& Intent) { MoveIntent = Intent; }

	/** Request an attack. Returns true if it started. */
	bool TryAttack(EMoteAttackSlot Slot);

	/** Hold to raise the shield. */
	void SetShielding(bool bWantsShield) { bShieldRequested = bWantsShield; }

	/** Hover-hop; doubles as a dodge. */
	void TryHop();

protected:
	virtual void BeginPlay() override;

	// ---- Input (Enhanced Input, built in C++ at runtime) -------------------
	void OnMoveFwd(const FInputActionValue& V);
	void OnMoveBack(const FInputActionValue& V);
	void OnMoveLeft(const FInputActionValue& V);
	void OnMoveRight(const FInputActionValue& V);
	void OnHop(const FInputActionValue& V);
	void OnPrimary(const FInputActionValue& V);
	void OnSpecial(const FInputActionValue& V);
	void OnShieldPressed(const FInputActionValue& V);
	void OnShieldReleased(const FInputActionValue& V);
	void OnCycleCore(const FInputActionValue& V);

	/** Fabricates the InputActions + MappingContext without any .uasset. */
	void BuildRuntimeInput();

	// ---- Attack resolution --------------------------------------------------
	void ResolveAttack(const FMoteAttackDef& Attack);
	void ResolveMelee(const FMoteAttackDef& Attack);
	void FireProjectiles(const FMoteAttackDef& Attack);
	void ReflectNearbyProjectiles();

	/** Rebuild dynamic materials to match the equipped Core's colour. */
	void ApplyCoreColor();

	// ---- Components ---------------------------------------------------------

	/** Everything visual hangs off this so the capsule can stay upright. */
	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual")
	TObjectPtr<USceneComponent> VisualRoot;

	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual")
	TObjectPtr<UStaticMeshComponent> Body;

	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual")
	TObjectPtr<UStaticMeshComponent> HandL;

	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual")
	TObjectPtr<UStaticMeshComponent> HandR;

	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual")
	TObjectPtr<UStaticMeshComponent> Visor;

	/** Chest crystal - glows the equipped Core's colour. */
	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual")
	TObjectPtr<UStaticMeshComponent> CoreCrystal;

	/** Soft light under the Mote, sells the hover. */
	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual")
	TObjectPtr<UPointLightComponent> CoreLight;

	UPROPERTY(VisibleAnywhere, Category = "Mote|Camera")
	TObjectPtr<USpringArmComponent> CameraBoom;

	UPROPERTY(VisibleAnywhere, Category = "Mote|Camera")
	TObjectPtr<UCameraComponent> TopDownCamera;

	/** Only the locally controlled player needs a camera. */
	UPROPERTY(EditAnywhere, Category = "Mote|Camera")
	bool bWantsCamera = true;

	// ---- Tunables -----------------------------------------------------------

	UPROPERTY(EditAnywhere, Category = "Mote|Stats")
	float MaxHealth = 6.f;

	UPROPERTY(EditAnywhere, Category = "Mote|Stats")
	float MoveSpeed = 620.f;

	/** Height the body floats above the capsule base. */
	UPROPERTY(EditAnywhere, Category = "Mote|Stats")
	float HoverHeight = 34.f;

	UPROPERTY(EditAnywhere, Category = "Mote|Stats")
	float InvulnTime = 0.55f;

	UPROPERTY(EditAnywhere, Category = "Mote|Stats")
	float ShieldDrainPerSecond = 0.34f;

	UPROPERTY(EditAnywhere, Category = "Mote|Stats")
	float ShieldRegenPerSecond = 0.22f;

	/** Base body tint; the Core only drives the crystal and hands. */
	UPROPERTY(EditAnywhere, Category = "Mote|Visual")
	FLinearColor BodyColor = FLinearColor(0.93f, 0.90f, 0.84f);

private:
	// ---- Runtime state ------------------------------------------------------
	UPROPERTY() EMoteCore CurrentCore = EMoteCore::Blade;
	UPROPERTY() EMoteState State = EMoteState::Idle;

	float Health = 6.f;
	float InvulnTimer = 0.f;
	float HurtTimer = 0.f;
	float FlashTimer = 0.f;
	float ReflectTimer = 0.f;
	float HoverPhase = 0.f;

	/** Attack in flight. */
	FMoteAttackDef ActiveAttack;
	float AttackTimer = 0.f;
	bool bAttackResolved = false;
	EMoteAttackSlot ActiveSlot = EMoteAttackSlot::Primary;
	FVector DashDirection = FVector::ZeroVector;

	float CooldownPrimary = 0.f;
	float CooldownSpecial = 0.f;

	bool bShielding = false;
	bool bShieldRequested = false;
	bool bShieldBroken = false;
	float ShieldStamina = 1.f;
	float ShieldBrokenTimer = 0.f;

	FVector2D MoveIntent = FVector2D::ZeroVector;

	// ---- Materials ----------------------------------------------------------
	UPROPERTY() TObjectPtr<UMaterialInstanceDynamic> BodyMID;
	UPROPERTY() TObjectPtr<UMaterialInstanceDynamic> HandLMID;
	UPROPERTY() TObjectPtr<UMaterialInstanceDynamic> HandRMID;
	UPROPERTY() TObjectPtr<UMaterialInstanceDynamic> CrystalMID;
	UPROPERTY() TObjectPtr<UMaterialInstanceDynamic> VisorMID;

	// ---- Runtime-fabricated input -------------------------------------------
	UPROPERTY() TObjectPtr<UInputMappingContext> MappingContext;
	UPROPERTY() TObjectPtr<UInputAction> IA_MoveFwd;
	UPROPERTY() TObjectPtr<UInputAction> IA_MoveBack;
	UPROPERTY() TObjectPtr<UInputAction> IA_MoveLeft;
	UPROPERTY() TObjectPtr<UInputAction> IA_MoveRight;
	UPROPERTY() TObjectPtr<UInputAction> IA_Hop;
	UPROPERTY() TObjectPtr<UInputAction> IA_Primary;
	UPROPERTY() TObjectPtr<UInputAction> IA_Special;
	UPROPERTY() TObjectPtr<UInputAction> IA_Shield;
	UPROPERTY() TObjectPtr<UInputAction> IA_CycleCore;
};
