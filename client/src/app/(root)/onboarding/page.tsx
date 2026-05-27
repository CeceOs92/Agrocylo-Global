"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useProfile } from "@/context/ProfileContext";
import { createProfile, registerLocation } from "@/services/profileService";
import StepProgress from "@/components/onboarding/StepProgress";
import ConnectWallet from "@/components/onboarding/ConnectWallet";
import SelectRole from "@/components/onboarding/SelectRole";
import ProfileForm from "@/components/onboarding/ProfileForm";
import LocationConsent from "@/components/onboarding/LocationConsent";
import Complete from "@/components/onboarding/Complete";

export default function OnboardingPage() {
  const router = useRouter();
  const { address } = useWallet();
  const { setProfile } = useProfile();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState<"farmer" | "buyer" | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLocationComplete(
    location: {
      latitude: number;
      longitude: number;
      city: string;
      country: string;
      isPublic: boolean;
    } | null
  ) {
    if (!address || !role) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const created = await createProfile(
        {
          role,
          display_name: displayName.trim(),
          bio: bio.trim() || undefined,
        },
        address
      );
      // Seed the profile cache so AuthGuard sees the user as onboarded immediately,
      // without waiting for a refetch round-trip.
      setProfile(created);

      if (location) {
        await registerLocation(
          {
            latitude: location.latitude,
            longitude: location.longitude,
            city: location.city || null,
            country: location.country || null,
            is_public: location.isPublic,
          },
          address
        );
      }

      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="from-secondary/30 to-background flex min-h-screen flex-col items-center bg-gradient-to-b px-4 pt-32 pb-16 md:pt-40">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Welcome to AgroCylo 🌾
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            A few quick steps to set up your profile.
          </p>
        </div>

        <StepProgress currentStep={step} />

        {error && (
          <div className="bg-destructive/10 text-destructive border-destructive/30 mx-auto mb-4 max-w-md rounded-lg border px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {step === 1 && <ConnectWallet onNext={() => setStep(2)} />}

        {step === 2 && (
          <SelectRole
            selected={role}
            onSelect={setRole}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <ProfileForm
            displayName={displayName}
            bio={bio}
            onUpdate={(data) => {
              setDisplayName(data.displayName);
              setBio(data.bio);
            }}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && (
          <LocationConsent
            onComplete={handleLocationComplete}
            onBack={() => setStep(3)}
            isSubmitting={isSubmitting}
          />
        )}

        {step === 5 && role && <Complete role={role} />}
      </div>
    </div>
  );
}
