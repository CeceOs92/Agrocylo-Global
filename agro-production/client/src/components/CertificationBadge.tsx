"use client";

import { useState } from "react";

interface Certification {
  id: string;
  type: string;
  issuingOrganization: string;
  issuedAt: string;
  expiresAt?: string;
  verified: boolean;
}

interface CertificationBadgeProps {
  certifications: Certification[];
  compact?: boolean;
}

export function CertificationBadge({ certifications, compact = false }: CertificationBadgeProps) {
  const [selectedCert, setSelectedCert] = useState<Certification | null>(null);

  if (!certifications || certifications.length === 0) {
    return null;
  }

  const getCertIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      organic: "🌱",
      "fair-trade": "🤝",
      sustainability: "♻️",
      "eco-friendly": "🌍",
      default: "✓",
    };
    return icons[type.toLowerCase()] || icons.default;
  };

  const getCertColor = (type: string) => {
    const colors: { [key: string]: string } = {
      organic: "bg-green-100 text-green-800 border-green-300",
      "fair-trade": "bg-blue-100 text-blue-800 border-blue-300",
      sustainability: "bg-teal-100 text-teal-800 border-teal-300",
      "eco-friendly": "bg-emerald-100 text-emerald-800 border-emerald-300",
      default: "bg-gray-100 text-gray-800 border-gray-300",
    };
    return colors[type.toLowerCase()] || colors.default;
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {certifications.map((cert) => (
          <button
            key={cert.id}
            onClick={() => setSelectedCert(cert)}
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getCertColor(cert.type)}`}
            aria-label={`${cert.type} certification`}
            title={`${cert.type} - Click for details`}
          >
            <span className="mr-1">{getCertIcon(cert.type)}</span>
            {cert.type}
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {certifications.map((cert) => (
          <div
            key={cert.id}
            className={`flex items-start p-3 rounded-lg border ${getCertColor(cert.type)}`}
          >
            <span className="text-2xl mr-3" aria-hidden="true">
              {getCertIcon(cert.type)}
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold capitalize">{cert.type} Certification</h4>
                {cert.verified && (
                  <span className="text-xs font-medium" aria-label="Verified">
                    ✓ Verified
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedCert(cert)}
                className="text-sm underline hover:no-underline mt-1"
                aria-label="View certification details"
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedCert && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedCert(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cert-modal-title"
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="cert-modal-title" className="text-xl font-bold mb-4 capitalize">
              {selectedCert.type} Certification
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-600">Issuing Organization</dt>
                <dd className="mt-1">{selectedCert.issuingOrganization}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600">Issued Date</dt>
                <dd className="mt-1">
                  {new Date(selectedCert.issuedAt).toLocaleDateString()}
                </dd>
              </div>
              {selectedCert.expiresAt && (
                <div>
                  <dt className="text-sm font-medium text-gray-600">Expires</dt>
                  <dd className="mt-1">
                    {new Date(selectedCert.expiresAt).toLocaleDateString()}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-600">Status</dt>
                <dd className="mt-1">
                  {selectedCert.verified ? (
                    <span className="text-green-600 font-medium">✓ Verified</span>
                  ) : (
                    <span className="text-gray-600">Pending Verification</span>
                  )}
                </dd>
              </div>
            </dl>
            <button
              onClick={() => setSelectedCert(null)}
              className="mt-6 w-full bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300 transition"
              aria-label="Close dialog"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
