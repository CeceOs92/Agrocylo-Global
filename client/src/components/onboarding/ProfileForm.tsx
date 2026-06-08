"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAnalytics } from "@/hooks/useAnalytics";

interface ProfileFormProps {
  displayName: string;
  bio: string;
  onUpdate: (data: { displayName: string; bio: string }) => void;
  onNext: () => void;
  onBack: () => void;
}

const BIO_LIMIT = 280;

export default function ProfileForm({
  displayName,
  bio,
  onUpdate,
  onNext,
  onBack,
}: ProfileFormProps) {
  const [nameError, setNameError] = useState<string | undefined>();
  const { trackFunnelStep } = useAnalytics();

  function handleNext() {
    if (!displayName.trim()) {
      setNameError("Display name is required");
      trackFunnelStep("onboarding_completion", "profile_validation_failed", {
        reason: "missing_display_name",
      });
      return;
    }
    setNameError(undefined);
    trackFunnelStep("onboarding_completion", "profile_completed", {
      hasBio: Boolean(bio.trim()),
    });
    onNext();
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Your Profile</CardTitle>
        <CardDescription>Tell others about yourself.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Input
            label="Display Name"
            placeholder="e.g. John's Farm"
            value={displayName}
            onChange={(e) => {
              onUpdate({ displayName: e.target.value, bio });
              if (nameError) setNameError(undefined);
            }}
            error={nameError}
          />

          <div className="grid w-full gap-1.5">
            <Label htmlFor="onboarding-bio">Bio (optional)</Label>
            <Textarea
              id="onboarding-bio"
              placeholder="Organic tomatoes and peppers from Lagos…"
              rows={3}
              maxLength={BIO_LIMIT}
              value={bio}
              onChange={(e) => onUpdate({ displayName, bio: e.target.value })}
            />
            <p className="text-muted-foreground text-right text-xs">
              {bio.length}/{BIO_LIMIT}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              trackFunnelStep("onboarding_completion", "profile_step_back");
              onBack();
            }}
            className="flex-1"
          >
            Back
          </Button>
          <Button onClick={handleNext} className="flex-[2]">
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
