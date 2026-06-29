import {
  DetectLabelsCommand,
  RekognitionClient,
  type Label,
} from "@aws-sdk/client-rekognition";

const REQUIRED_AWS_ENV_VARS = [
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
] as const;

const normalizeLabel = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const PET_LABELS = new Set(
  [
    "pet",
    "dog",
    "cat",
    "puppy",
    "kitten",
    "bird",
    "fish",
    "horse",
    "rabbit",
    "hamster",
    "ferret",
    "guineapig",
    "lizard",
    "snake",
    "turtle",
    "parrot",
  ].map((label) => normalizeLabel(label)),
);

const hasAwsConfig = () =>
  REQUIRED_AWS_ENV_VARS.every((key) => typeof process.env[key] === "string" && process.env[key]);

const createClient = () => {
  if (!hasAwsConfig()) {
    return null;
  }

  return new RekognitionClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
  });
};

const matchesPetLabel = (labels: Label[]) =>
  labels.some((label) => {
    const names = [label.Name, ...(label.Parents?.map((parent) => parent.Name) ?? [])].filter(
      (name): name is string => typeof name === "string" && name.length > 0,
    );

    return names.some((name) => PET_LABELS.has(normalizeLabel(name)));
  });

export type PhotoValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: "missing-config" | "not-pet" | "validation-error";
    };

export async function validatePetPhoto(bytes: Buffer): Promise<PhotoValidationResult> {
  const client = createClient();
  if (!client) {
    return { ok: false, reason: "missing-config" };
  }

  try {
    const response = await client.send(
      new DetectLabelsCommand({
        Image: { Bytes: bytes },
        MaxLabels: 10,
        MinConfidence: 80,
      }),
    );
    const labels = response.Labels ?? [];

    return matchesPetLabel(labels) ? { ok: true } : { ok: false, reason: "not-pet" };
  } catch {
    return { ok: false, reason: "validation-error" };
  }
}
