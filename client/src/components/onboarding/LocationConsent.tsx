"use client";

import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface LocationConsentProps {
  onComplete: (
    location: {
      latitude: number;
      longitude: number;
      city: string;
      country: string;
      isPublic: boolean;
    } | null,
  ) => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export default function LocationConsent({
  onComplete,
  onBack,
  isSubmitting,
}: LocationConsentProps) {
  const [mode, setMode] = useState<"ask" | "detecting" | "manual">("ask");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  function handleShareLocation() {
    if (!navigator.geolocation) {
      setMode("manual");
      return;
    }
    setMode("detecting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onComplete({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          city: "",
          country: "",
          isPublic,
        });
      },
      () => setMode("manual"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function handleManualSubmit() {
    if (!city.trim() || !country.trim()) return;
    // Manual entry: backend can geocode 0,0 sentinel later if needed.
    onComplete({
      latitude: 0,
      longitude: 0,
      city: city.trim(),
      country: country.trim(),
      isPublic,
    });
  }

  if (mode === "ask") {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Share Your Location</CardTitle>
          <CardDescription>
            Help buyers and farmers find you nearby.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-primary/5 border-primary/20 rounded-2xl border p-4">
            <p className="text-sm">
              Share your location so buyers and farmers can find you.{" "}
              <strong>Your exact coordinates are never shown publicly</strong>{" "}
              — only your city and approximate distance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="loc-public"
              checked={isPublic}
              onCheckedChange={(v) => setIsPublic(Boolean(v))}
            />
            <Label htmlFor="loc-public" className="cursor-pointer">
              Show my location on the map
            </Label>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleShareLocation}
              isLoading={isSubmitting}
              className="w-full"
            >
              <MapPin className="size-4" />
              Allow Location Access
            </Button>
            <Button
              variant="outline"
              onClick={() => setMode("manual")}
              className="w-full"
            >
              Enter Manually Instead
            </Button>
            <Button
              variant="ghost"
              onClick={() => onComplete(null)}
              disabled={isSubmitting}
              className="w-full"
            >
              Skip for Now
            </Button>
          </div>

          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mode === "detecting") {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Loader2 className="text-primary size-10 animate-spin" />
          <p className="font-medium">Detecting your location…</p>
          <p className="text-muted-foreground text-sm">
            Please allow location access in your browser.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Enter Your Location</CardTitle>
        <CardDescription>
          We&apos;ll show your approximate area on the map.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Input
            label="City"
            placeholder="e.g. Lagos"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Input
            label="Country"
            placeholder="e.g. Nigeria"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />

          <div className="flex items-center gap-3">
            <Checkbox
              id="loc-manual-public"
              checked={isPublic}
              onCheckedChange={(v) => setIsPublic(Boolean(v))}
            />
            <Label htmlFor="loc-manual-public" className="cursor-pointer">
              Show my location on the map
            </Label>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
          <Button
            disabled={!city.trim() || !country.trim()}
            onClick={handleManualSubmit}
            isLoading={isSubmitting}
            className="flex-[2]"
          >
            Save Location
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
