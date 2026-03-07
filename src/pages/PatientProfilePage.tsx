import { FormEvent, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchPatient } from "@/lib/api";

const API_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE || "https://dementia-monitoring-api";

const PatientProfilePage = () => {
  const { isAuthenticated, getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const [patientId, setPatientId] = useState("1");
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [errorText, setErrorText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onFetchProfile = (event: FormEvent) => {
    event.preventDefault();
    void (async () => {
      setIsLoading(true);
      setErrorText("");
      try {
        const token = isAuthenticated
          ? await getAccessTokenSilently({
              authorizationParams: { audience: API_AUDIENCE },
            })
          : undefined;
        const response = await fetchPatient(Number(patientId), token);
        setPayload(response as Record<string, unknown>);
      } catch (error) {
        setPayload(null);
        setErrorText(error instanceof Error ? error.message : "Failed to fetch patient.");
      } finally {
        setIsLoading(false);
      }
    })();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <Link to="/" className="text-sm text-primary underline-offset-2 hover:underline">
          Back to Home
        </Link>
        <h1 className="text-2xl font-semibold">Patient API View</h1>
        <p className="text-sm text-muted-foreground">
          Fetches backend data from `GET /patient/{`{id}`}`.
        </p>
      </div>

      {!isAuthenticated && (
        <Button onClick={() => loginWithRedirect()}>Sign In</Button>
      )}

      <form onSubmit={onFetchProfile} className="space-y-3 rounded-lg border p-4">
        <div className="max-w-xs space-y-2">
          <Label htmlFor="patient_profile_id">patient_id</Label>
          <Input
            id="patient_profile_id"
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Loading..." : "Fetch Patient"}
        </Button>
      </form>

      {errorText && (
        <div className="rounded-md border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
          {errorText}
        </div>
      )}

      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-medium">Response</h2>
        <pre className="max-h-[480px] overflow-auto rounded bg-muted p-3 text-xs">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </section>
    </div>
  );
};

export default PatientProfilePage;
