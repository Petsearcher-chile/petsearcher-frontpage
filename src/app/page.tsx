"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import dynamic from "next/dynamic";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ChangeEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RegisteredPetMarker } from "@/components/MapView";
import dancingMonkeyAnimation from "@/assets/Dancing Monkey.json";
import turtleSkatingAnimation from "@/assets/Turtle Skating.json";

function LoadingMapFallback() {
  const tCommon = useTranslations("Common");

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-100 dark:bg-zinc-900">
      <p className="text-zinc-500">{tCommon("loading_map")}</p>
    </div>
  );
}

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <LoadingMapFallback />,
});

type SelectedAddressDetail = {
  fullAddress: string;
  longitude: number;
  latitude: number;
  country: string | null;
  region: string | null;
  city: string | null;
  postcode: string | null;
  street: string | null;
  houseNumber: string | null;
};

type SelectedLostPetMarker = RegisteredPetMarker;

type LanguageOption = {
  value: string;
  label: string;
  flag: string;
};

const LOCATION_EVENT_NAME = "petsearcher:location-selected";
const AUTOSELECT_REQUEST_EVENT_NAME = "petsearcher:location-autoselect-request";
const LOST_PET_FORM_SEARCH_PARAM = "pum";
const FOUND_PET_FORM_SEARCH_PARAM = "eum";
const MONKEY_INTRO_ENTRY_DELAY_MS = 3000;
const MONKEY_INTRO_SECOND_MESSAGE_DELAY_MS = 3000;
const MONKEY_INTRO_THIRD_MESSAGE_DELAY_MS = 4000;
const MONKEY_INTRO_FOURTH_MESSAGE_DELAY_MS = 4000;
const LOST_PET_NAME_MAX_LENGTH = 30;
const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "es", label: "Español", flag: "🇪🇸" },
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "en-gb", label: "English (UK)", flag: "🇬🇧" },
  { value: "pt", label: "Português", flag: "🇵🇹" },
  { value: "fr", label: "Français", flag: "🇫🇷" },
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "it", label: "Italiano", flag: "🇮🇹" },
  { value: "nl", label: "Nederlands", flag: "🇳🇱" },
  { value: "sv", label: "Svenska", flag: "🇸🇪" },
  { value: "no", label: "Norsk", flag: "🇳🇴" },
  { value: "da", label: "Dansk", flag: "🇩🇰" },
  { value: "fi", label: "Suomi", flag: "🇫🇮" },
  { value: "is", label: "Íslenska", flag: "🇮🇸" },
  { value: "pl", label: "Polski", flag: "🇵🇱" },
  { value: "cs", label: "Čeština", flag: "🇨🇿" },
  { value: "sk", label: "Slovenčina", flag: "🇸🇰" },
  { value: "sl", label: "Slovenščina", flag: "🇸🇮" },
  { value: "hr", label: "Hrvatski", flag: "🇭🇷" },
  { value: "sr", label: "Srpski", flag: "🇷🇸" },
  { value: "bs", label: "Bosanski", flag: "🇧🇦" },
  { value: "ro", label: "Română", flag: "🇷🇴" },
  { value: "bg", label: "Български", flag: "🇧🇬" },
  { value: "ru", label: "Русский", flag: "🇷🇺" },
  { value: "uk", label: "Українська", flag: "🇺🇦" },
  { value: "be", label: "Беларуская", flag: "🇧🇾" },
  { value: "el", label: "Ελληνικά", flag: "🇬🇷" },
  { value: "tr", label: "Türkçe", flag: "🇹🇷" },
  { value: "he", label: "עברית", flag: "🇮🇱" },
  { value: "ar", label: "العربية", flag: "🇸🇦" },
  { value: "fa", label: "فارسی", flag: "🇮🇷" },
  { value: "ur", label: "اردو", flag: "🇵🇰" },
  { value: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { value: "bn", label: "বাংলা", flag: "🇧🇩" },
  { value: "pa", label: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  { value: "ta", label: "தமிழ்", flag: "🇮🇳" },
  { value: "te", label: "తెలుగు", flag: "🇮🇳" },
  { value: "ml", label: "മലയാളം", flag: "🇮🇳" },
  { value: "mr", label: "मराठी", flag: "🇮🇳" },
  { value: "gu", label: "ગુજરાતી", flag: "🇮🇳" },
  { value: "kn", label: "ಕನ್ನಡ", flag: "🇮🇳" },
  { value: "th", label: "ไทย", flag: "🇹🇭" },
  { value: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { value: "id", label: "Bahasa Indonesia", flag: "🇮🇩" },
  { value: "ms", label: "Bahasa Melayu", flag: "🇲🇾" },
  { value: "fil", label: "Filipino", flag: "🇵🇭" },
  { value: "ja", label: "日本語", flag: "🇯🇵" },
  { value: "ko", label: "한국어", flag: "🇰🇷" },
  { value: "zh", label: "中文", flag: "🇨🇳" },
  { value: "yue", label: "粵語", flag: "🇭🇰" },
  { value: "km", label: "ខ្មែរ", flag: "🇰🇭" },
  { value: "lo", label: "ລາວ", flag: "🇱🇦" },
  { value: "my", label: "မြန်မာဘာသာ", flag: "🇲🇲" },
  { value: "sw", label: "Kiswahili", flag: "🇰🇪" },
  { value: "am", label: "አማርኛ", flag: "🇪🇹" },
  { value: "zu", label: "isiZulu", flag: "🇿🇦" },
  { value: "af", label: "Afrikaans", flag: "🇿🇦" },
  { value: "xh", label: "isiXhosa", flag: "🇿🇦" },
  { value: "eo", label: "Esperanto", flag: "🏳️" },
] as const;

const normalizeLanguageValue = (value: string | null) =>
  value ? value.toLowerCase().replaceAll("_", "-").split("-")[0] ?? value.toLowerCase() : "";

const getCookieValue = (name: string) => {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const getBrowserLanguageOption = () => {
  if (typeof navigator === "undefined") {
    return LANGUAGE_OPTIONS[0];
  }

  const browserLanguages = [navigator.language, ...navigator.languages].filter(
    (language): language is string => Boolean(language),
  );

  for (const browserLanguage of browserLanguages) {
    const normalizedBrowserLanguage = normalizeLanguageValue(browserLanguage);
    const exactMatch = LANGUAGE_OPTIONS.find(
      (option) =>
        option.value === browserLanguage.toLowerCase() ||
        option.value === normalizedBrowserLanguage,
    );
    if (exactMatch) {
      return exactMatch;
    }
  }

  const browserPrimaryLanguage = normalizeLanguageValue(browserLanguages[0] ?? "");
  return (
    LANGUAGE_OPTIONS.find((option) => option.value === browserPrimaryLanguage) ??
    LANGUAGE_OPTIONS[0]
  );
};

const getPreferredLanguageOption = () => {
  const cookieLocale = normalizeLanguageValue(getCookieValue("locale"));
  if (cookieLocale) {
    const cookieLanguage = LANGUAGE_OPTIONS.find((option) => option.value === cookieLocale);
    if (cookieLanguage) {
      return cookieLanguage;
    }
  }

  return getBrowserLanguageOption();
};

const formatLostPetDate = (value: string | null, unavailableText: string) => {
  if (!value) {
    return unavailableText;
  }

  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return value;
  }

  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const router = useRouter();
  const pathname = usePathname();
  const tCommon = useTranslations("Common");
  const tIndex = useTranslations("Index");
  const initialBrowserLanguage = getPreferredLanguageOption();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activePetForm, setActivePetForm] = useState<"lost" | "found" | null>(null);
  const [petLossId, setPetLossId] = useState<number | null>(null);
  const [lostPetDate, setLostPetDate] = useState("");
  const [lostPetName, setLostPetName] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [, setHasSelectedLocation] = useState(false);
  const [selectedAddressDetail, setSelectedAddressDetail] =
    useState<SelectedAddressDetail | null>(null);
  const [selectedLostPet, setSelectedLostPet] =
    useState<SelectedLostPetMarker | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState(initialBrowserLanguage.value);
  const [languageQuery, setLanguageQuery] = useState("");
  const [isLanguageSearching, setIsLanguageSearching] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [uploadedThumbnailPreviews, setUploadedThumbnailPreviews] = useState<
    { id: string; thumbnailUrl: string; originalUrl: string; name: string }[]
  >([]);
  const [hoveredPreview, setHoveredPreview] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [hoveredLostPetPhoto, setHoveredLostPetPhoto] = useState<{
    url: string;
    name: string;
    isLoading: boolean;
  } | null>(null);
  const [copyTooltip, setCopyTooltip] = useState<{
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);
  const [isMonkeyVisible, setIsMonkeyVisible] = useState(false);
  const [monkeyDialogue, setMonkeyDialogue] = useState<string>("");
  const [isMonkeyAnimating, setIsMonkeyAnimating] = useState(true);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const uploadResetTimerRef = useRef<number | null>(null);
  const thumbnailUrlsRef = useRef<string[]>([]);
  const lastSelectedAddressRef = useRef<SelectedAddressDetail | null>(null);
  const monkeyLottieRef = useRef<LottieRefCurrentProps | null>(null);
  const monkeyTimeoutsRef = useRef<number[]>([]);
  const copyTooltipTimerRef = useRef<number | null>(null);
  const hasTriggeredAddressGuideRef = useRef(false);
  const hasTriggeredInicioGuideRef = useRef(false);
  const introMonkeyDialogueMessages = useMemo(
    () => [
      tIndex("intro_monkey_1"),
      tIndex("intro_monkey_2"),
      tIndex("intro_monkey_3"),
      tIndex("intro_monkey_4"),
    ] as const,
    [tIndex],
  );
  const addressConfirmationDialogue = tIndex("address_confirmation");
  const addressNextStepDialogue = tIndex("address_next_step");
  const inicioConfirmationDialogue = tIndex("inicio_confirmation");
  const inicioNextStepDialogue = tIndex("inicio_next_step");

  useEffect(() => {
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get(FOUND_PET_FORM_SEARCH_PARAM) === "true") {
        setIsPanelOpen(true);
        setActivePetForm("found");
        return;
      }

      if (
        params.get(LOST_PET_FORM_SEARCH_PARAM) === "true" ||
        params.get("pun") === "true"
      ) {
        setIsPanelOpen(true);
        setActivePetForm("lost");
      }
    });
  }, []);

  const clearMonkeyTimeouts = useCallback(() => {
    monkeyTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    monkeyTimeoutsRef.current = [];
  }, []);

  const queueMonkeyTimeout = useCallback((callback: () => void, delayMs: number) => {
    const timeoutId = window.setTimeout(callback, delayMs);
    monkeyTimeoutsRef.current.push(timeoutId);
  }, []);

  const setMonkeyMotion = useCallback((isAnimating: boolean) => {
    setIsMonkeyAnimating(isAnimating);
    if (isAnimating) {
      monkeyLottieRef.current?.play();
      return;
    }

    monkeyLottieRef.current?.pause();
  }, []);

  const runAddressSelectedGuide = useCallback(() => {
    clearMonkeyTimeouts();
    setIsMonkeyVisible(true);
    setMonkeyDialogue(addressConfirmationDialogue);
    setMonkeyMotion(true);

    queueMonkeyTimeout(() => {
      setMonkeyDialogue(addressNextStepDialogue);
      setMonkeyMotion(true);
    }, 4000);

    queueMonkeyTimeout(() => {
      setMonkeyMotion(false);
    }, 6000);
  }, [addressConfirmationDialogue, addressNextStepDialogue, clearMonkeyTimeouts, queueMonkeyTimeout, setMonkeyMotion]);

  const runInicioGuide = useCallback(() => {
    clearMonkeyTimeouts();
    setIsMonkeyVisible(true);
    setMonkeyDialogue(inicioConfirmationDialogue);
    setMonkeyMotion(true);

    queueMonkeyTimeout(() => {
      setMonkeyDialogue(inicioNextStepDialogue);
      setMonkeyMotion(true);
    }, 3000);

    queueMonkeyTimeout(() => {
      setMonkeyMotion(false);
      setMonkeyDialogue("");
      setIsMonkeyVisible(false);
    }, 8000);
  }, [clearMonkeyTimeouts, inicioConfirmationDialogue, inicioNextStepDialogue, queueMonkeyTimeout, setMonkeyMotion]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsMonkeyVisible(true);
      setMonkeyDialogue(introMonkeyDialogueMessages[0]);
      setMonkeyMotion(true);

      const thirdMessageDelay =
        MONKEY_INTRO_SECOND_MESSAGE_DELAY_MS + MONKEY_INTRO_THIRD_MESSAGE_DELAY_MS;
      const fourthMessageDelay = thirdMessageDelay + MONKEY_INTRO_FOURTH_MESSAGE_DELAY_MS;

      queueMonkeyTimeout(() => {
        setMonkeyDialogue(introMonkeyDialogueMessages[1]);
      }, MONKEY_INTRO_SECOND_MESSAGE_DELAY_MS);

      queueMonkeyTimeout(() => {
        setMonkeyDialogue(introMonkeyDialogueMessages[2]);
      }, thirdMessageDelay);

      queueMonkeyTimeout(() => {
        setMonkeyDialogue(introMonkeyDialogueMessages[3]);
        setMonkeyMotion(false);
      }, fourthMessageDelay);
    }, MONKEY_INTRO_ENTRY_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
      clearMonkeyTimeouts();
    };
  }, [clearMonkeyTimeouts, introMonkeyDialogueMessages, queueMonkeyTimeout, setMonkeyMotion]);

  const updatePetFormSearchParam = useCallback(
    (form: "lost" | "found" | null) => {
      const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : "",
      );
      if (form === "lost") {
        params.delete(FOUND_PET_FORM_SEARCH_PARAM);
        params.set(LOST_PET_FORM_SEARCH_PARAM, "true");
      } else if (form === "found") {
        params.delete(LOST_PET_FORM_SEARCH_PARAM);
        params.set(FOUND_PET_FORM_SEARCH_PARAM, "true");
      } else {
        params.delete(LOST_PET_FORM_SEARCH_PARAM);
        params.delete(FOUND_PET_FORM_SEARCH_PARAM);
        params.delete("pun");
      }

      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    },
    [pathname, router],
  );

  useEffect(() => {
    const handleLocationSelected = (event: Event) => {
      const customEvent = event as CustomEvent<{
        selected?: boolean;
        address?: SelectedAddressDetail;
      }>;
      const selected = Boolean(customEvent.detail?.selected);

      if (!selected) {
        lastSelectedAddressRef.current = null;
        setHasSelectedLocation(false);
        setSelectedAddressDetail(null);
        return;
      }

      const receivedAddress = customEvent.detail?.address;
      if (receivedAddress) {
        lastSelectedAddressRef.current = receivedAddress;
        setHasSelectedLocation(true);
        setSelectedAddressDetail(receivedAddress);
        if (!hasTriggeredAddressGuideRef.current) {
          hasTriggeredAddressGuideRef.current = true;
          runAddressSelectedGuide();
        }
        return;
      }

      if (lastSelectedAddressRef.current) {
        setHasSelectedLocation(true);
        setSelectedAddressDetail(lastSelectedAddressRef.current);
        return;
      }

      setHasSelectedLocation(false);
      setSelectedAddressDetail(null);
    };

    window.addEventListener(LOCATION_EVENT_NAME, handleLocationSelected);

    return () => {
      window.removeEventListener(LOCATION_EVENT_NAME, handleLocationSelected);
      if (uploadResetTimerRef.current !== null) {
        window.clearTimeout(uploadResetTimerRef.current);
      }
      thumbnailUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [runAddressSelectedGuide]);

  const requestAddressAutoselection = useCallback(() => {
    return new Promise<SelectedAddressDetail | null>((resolve) => {
      let settled = false;
      const handleLocationSelected = (event: Event) => {
        if (settled) {
          return;
        }

        const customEvent = event as CustomEvent<{
          selected?: boolean;
          address?: SelectedAddressDetail;
        }>;
        const receivedAddress = customEvent.detail?.address ?? lastSelectedAddressRef.current;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(customEvent.detail?.selected ? (receivedAddress ?? null) : null);
      };
      const timeoutId = window.setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        window.removeEventListener(LOCATION_EVENT_NAME, handleLocationSelected);
        resolve(lastSelectedAddressRef.current);
      }, 1800);

      window.addEventListener(LOCATION_EVENT_NAME, handleLocationSelected, {
        once: true,
      });
      window.dispatchEvent(new CustomEvent(AUTOSELECT_REQUEST_EVENT_NAME));
    });
  }, []);

  const resetUploadProgress = useCallback(() => {
    if (uploadResetTimerRef.current !== null) {
      window.clearTimeout(uploadResetTimerRef.current);
      uploadResetTimerRef.current = null;
    }

    setUploadProgress(null);
  }, []);

  const clearThumbnailPreviews = useCallback(() => {
    thumbnailUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    thumbnailUrlsRef.current = [];
    setUploadedThumbnailPreviews([]);
    setHoveredPreview(null);
  }, []);

  const clearCopyTooltipTimer = useCallback(() => {
    if (copyTooltipTimerRef.current !== null) {
      window.clearTimeout(copyTooltipTimerRef.current);
      copyTooltipTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearCopyTooltipTimer();
    };
  }, [clearCopyTooltipTimer]);

  const handleCopyCreatorEmail = useCallback(
    async (email: string, event: MouseEvent<HTMLButtonElement>) => {
      await navigator.clipboard.writeText(email);
      const offsetX = 18;
      const offsetY = 18;
      const x = event.clientX + offsetX;
      const y = event.clientY + offsetY;

      clearCopyTooltipTimer();
      setCopyTooltip({ x, y, visible: true });
      copyTooltipTimerRef.current = window.setTimeout(() => {
        setCopyTooltip((current) => (current ? { ...current, visible: false } : current));
      }, 1400);
    },
    [clearCopyTooltipTimer],
  );

  const uploadPhotos = useCallback(
    (files: File[]) => {
      if (files.length === 0) {
        return;
      }
      if (activePetForm === null) {
        return;
      }

      resetUploadProgress();
      setPhotoError("");
      setUploadError("");
      setSaveSuccessMessage("");
      setUploadProgress(0);

      const formData = new FormData();
      const isFoundForm = activePetForm === "found";
      if (petLossId !== null) {
        formData.append(isFoundForm ? "petFoundId" : "petLossId", String(petLossId));
      }
      formData.append(isFoundForm ? "foundPetDate" : "lostPetDate", lostPetDate);
      formData.append(isFoundForm ? "foundPetName" : "lostPetName", lostPetName);
      files.forEach((file) => {
        formData.append("photos", file);
      });
      const pendingPreviews = files.map((file) => ({
        id: crypto.randomUUID(),
        url: URL.createObjectURL(file),
        name: file.name,
      }));

      const request = new XMLHttpRequest();
      request.open("POST", isFoundForm ? "/api/found-pet-photos" : "/api/lost-pet-photos");
      request.responseType = "json";

      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }

        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      };

      request.onload = () => {
        if (request.status < 200 || request.status >= 300) {
          const responseMessage =
            request.response &&
            typeof request.response === "object" &&
            "message" in request.response
              ? typeof request.response.message === "string"
                ? request.response.detail &&
                  typeof request.response.detail === "string"
                  ? `${request.response.message} ${request.response.detail}`
                  : request.response.message
                : tIndex("upload_photos_error")
              : tIndex("upload_photos_error");
          setUploadError(responseMessage);
          pendingPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
          setUploadProgress(null);
          return;
        }

        const responsePetLossId =
          request.response &&
          typeof request.response === "object" &&
          (isFoundForm ? "petFoundId" in request.response : "petLossId" in request.response) &&
          typeof (isFoundForm ? request.response.petFoundId : request.response.petLossId) ===
            "number"
            ? isFoundForm
              ? request.response.petFoundId
              : request.response.petLossId
            : null;
        if (responsePetLossId !== null) {
          setPetLossId(responsePetLossId);
        }

        const responsePreviews: {
          id: string;
          thumbnailUrl: string;
          originalUrl: string;
          name: string;
        }[] =
          request.response &&
          typeof request.response === "object" &&
          "previewImages" in request.response &&
          Array.isArray(request.response.previewImages)
            ? request.response.previewImages.filter(
                (
                  preview: unknown,
                ): preview is {
                  id: string;
                  thumbnailUrl: string;
                  originalUrl: string;
                  name: string;
                } =>
                  Boolean(
                    preview &&
                      typeof preview === "object" &&
                      "id" in preview &&
                      typeof preview.id === "string" &&
                      "thumbnailUrl" in preview &&
                      typeof preview.thumbnailUrl === "string" &&
                      "originalUrl" in preview &&
                      typeof preview.originalUrl === "string" &&
                      "name" in preview &&
                      typeof preview.name === "string",
                  ),
              )
            : [];

        pendingPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
        thumbnailUrlsRef.current.push(
          ...responsePreviews.flatMap((preview) => [preview.thumbnailUrl, preview.originalUrl]),
        );
        setUploadedThumbnailPreviews((current) => [...current, ...responsePreviews]);

        setUploadProgress(100);
        uploadResetTimerRef.current = window.setTimeout(() => {
          setUploadProgress(null);
          uploadResetTimerRef.current = null;
        }, 700);
      };

      request.onerror = () => {
        setUploadError(tIndex("upload_photos_error"));
        pendingPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
        setUploadProgress(null);
      };

      request.send(formData);
    },
    [activePetForm, lostPetDate, lostPetName, petLossId, resetUploadProgress, tIndex],
  );

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;

    if (!selectedFiles) {
      setPhotoError("");
      return;
    }

    if (selectedFiles.length + uploadedThumbnailPreviews.length > 10) {
      setPhotoError("");
      setUploadError(tIndex("max_photos_error"));
      event.target.value = "";
      return;
    }

    const files = Array.from(selectedFiles);
    const hasNonImage = files.some((file) => !file.type.startsWith("image/"));
    if (hasNonImage) {
      setPhotoError("");
      setUploadError(tIndex("image_only_error"));
      event.target.value = "";
      return;
    }

    setPhotoError("");
    setSaveSuccessMessage("");
    event.target.value = "";
    uploadPhotos(files);
  };

  const handleLostPetClick = useCallback(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      void openSignIn();
      return;
    }

    setSaveSuccessMessage("");
    setSelectedLostPet(null);
    setHoveredLostPetPhoto(null);
    setActivePetForm("lost");
    updatePetFormSearchParam("lost");
  }, [isLoaded, isSignedIn, openSignIn, updatePetFormSearchParam]);

  const handleFoundPetClick = useCallback(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      void openSignIn();
      return;
    }

    setSaveSuccessMessage("");
    setSelectedLostPet(null);
    setHoveredLostPetPhoto(null);
    setActivePetForm("found");
    updatePetFormSearchParam("found");
  }, [isLoaded, isSignedIn, openSignIn, updatePetFormSearchParam]);

  const lostPetNamePattern = /^(?!.*[ _\-°ñÑ]{2})[a-zA-Z0-9°_\-ñÑ ]+$/;
  const isLostPetNameValid =
    lostPetName.trim().length > 0 &&
    lostPetName.length <= LOST_PET_NAME_MAX_LENGTH &&
    lostPetNamePattern.test(lostPetName);
  const isSaveEnabled =
    uploadedThumbnailPreviews.length > 0 &&
    lostPetDate.trim().length > 0 &&
    (activePetForm === "found" ? true : isLostPetNameValid);

  const handleSaveClick = useCallback(() => {
    void (async () => {
      let addressToSave = selectedAddressDetail ?? lastSelectedAddressRef.current;

      if (!addressToSave) {
        addressToSave = await requestAddressAutoselection();
      }

      if (!addressToSave) {
        const isFoundForm = activePetForm === "found";
        setUploadError(
          isFoundForm
            ? tIndex("select_found_location_error")
            : tIndex("select_lost_location_error"),
        );
        return;
      }

      if (petLossId === null) {
        setUploadError(tIndex("must_upload_photo"));
        return;
      }

      if (lostPetName.length > LOST_PET_NAME_MAX_LENGTH) {
        setUploadError(
          tIndex("name_max_length_error", { max: LOST_PET_NAME_MAX_LENGTH }),
        );
        return;
      }

      setIsSaving(true);
      const isFoundForm = activePetForm === "found";
      void fetch(isFoundForm ? "/api/found-pet-save" : "/api/lost-pet-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isFoundForm
            ? {
                petFoundId: petLossId,
                foundPetDate: lostPetDate,
                foundPetName: lostPetName,
              }
            : {
                petLossId,
                lostPetDate,
                lostPetName,
              }),
          mapboxAddress: addressToSave,
        }),
      })
        .then(async (response) => {
          if (response.ok) {
            setUploadError("");
            setPhotoError("");
            setActivePetForm(null);
            setIsPanelOpen(false);
            updatePetFormSearchParam(null);
            setSelectedLostPet(null);
            setHoveredLostPetPhoto(null);
            setPetLossId(null);
            setLostPetDate("");
            setLostPetName("");
            setHasSelectedLocation(false);
            setSelectedAddressDetail(null);
            lastSelectedAddressRef.current = null;
            clearThumbnailPreviews();
            setSaveSuccessMessage(
              isFoundForm
                ? tIndex("save_success_found")
                : tIndex("save_success_lost"),
            );
            return;
          }

          const payload = (await response.json()) as { message?: string; detail?: string };
          const errorMessage =
            payload.message && payload.detail
              ? `${payload.message} ${payload.detail}`
              : payload.message ??
                isFoundForm ? tIndex("save_found_error") : tIndex("save_lost_error");
          setUploadError(errorMessage);
        })
        .catch(() => {
          setUploadError(
            isFoundForm ? tIndex("save_found_error") : tIndex("save_lost_error"),
          );
        })
        .finally(() => {
          setIsSaving(false);
        });
    })();
  }, [
    activePetForm,
    clearThumbnailPreviews,
    lostPetDate,
    lostPetName,
    petLossId,
    requestAddressAutoselection,
    selectedAddressDetail,
    tIndex,
    updatePetFormSearchParam,
  ]);

  const handleMarkerSelect = useCallback((marker: SelectedLostPetMarker) => {
    setSelectedLostPet(marker);
    setHoveredLostPetPhoto(null);
    setIsPanelOpen(false);
  }, []);

  const filteredLanguageOptions = LANGUAGE_OPTIONS.filter((language) => {
    const search = languageQuery.trim().toLowerCase();
    if (!search) {
      return true;
    }

    return (
      language.label.toLowerCase().includes(search) ||
      language.value.toLowerCase().includes(search) ||
      language.flag.includes(search)
    );
  });
  const selectedLanguageOption =
    LANGUAGE_OPTIONS.find((language) => language.value === selectedLanguage) ??
    initialBrowserLanguage;
  const languageInputValue = isLanguageSearching
    ? languageQuery
    : `${selectedLanguageOption.flag} ${selectedLanguageOption.label}`;

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <MapView
        onMarkerSelect={handleMarkerSelect}
        selectedMarkerId={selectedLostPet?.markerId ?? null}
        selectedMarkerType={selectedLostPet?.markerType ?? null}
        activePetForm={activePetForm}
      />

      {selectedLostPet ? (
        <aside className="absolute left-4 top-4 bottom-16 z-30 flex w-[min(90vw,500px)] md:w-[min(20vw,500px)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {selectedLostPet.petName ??
                  (selectedLostPet.markerType === "found"
                    ? tIndex("pet_found_label")
                    : tIndex("pet_lost_label"))}
              </p>
              <div className="mt-1 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                <p>
                  {selectedLostPet.markerType === "found"
                    ? tCommon("date_found")
                    : tCommon("date_lost")}
                  : {formatLostPetDate(selectedLostPet.lostPetDate, tCommon("not_available"))}
                </p>
                {selectedLostPet.creatorName ? (
                  <p>
                    {tCommon("published_by")} {selectedLostPet.creatorName}
                  </p>
                ) : null}
                {selectedLostPet.creatorEmail ? (
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 truncate">
                      {tCommon("email")} {selectedLostPet.creatorEmail}
                    </p>
                    <button
                      type="button"
                      aria-label={tCommon("copy_email")}
                      className="ml-auto shrink-0 text-zinc-700 transition hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-zinc-100"
                      onClick={(event) => {
                        void handleCopyCreatorEmail(selectedLostPet.creatorEmail ?? "", event);
                      }}
                    >
                      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
                        <path
                          d="M7 7.5V5.75A1.75 1.75 0 0 1 8.75 4h5.5A1.75 1.75 0 0 1 16 5.75v5.5A1.75 1.75 0 0 1 14.25 13H12.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M5.75 7A1.75 1.75 0 0 0 4 8.75v5.5A1.75 1.75 0 0 0 5.75 16h5.5A1.75 1.75 0 0 0 13 14.25v-5.5A1.75 1.75 0 0 0 11.25 7h-5.5Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                ) : null}
                <p>
                  {selectedLostPet.markerType === "found"
                    ? `${tCommon("se_found_near")} `
                    : `${tCommon("se_lost_near")} `}
                  {selectedLostPet.fullAddress}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => {
                setSelectedLostPet(null);
                setHoveredLostPetPhoto(null);
              }}
            >
              {tCommon("close")}
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-2 gap-3">
              {selectedLostPet.photos.map((photo, index) => (
                <div
                  key={`${selectedLostPet.markerId}-${index}`}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <img
                    src={photo.thumbnailUrl}
                    alt={`${selectedLostPet.petName ?? (selectedLostPet.markerType === "found"
                      ? tIndex("pet_found_label")
                      : tIndex("pet_lost_label"))} ${tIndex("photo_label", { number: index + 1 })}`}
                    className="h-36 w-full object-cover"
                    loading="lazy"
                    onMouseEnter={() =>
                      setHoveredLostPetPhoto({
                        url: photo.originalUrl ?? photo.thumbnailUrl,
                        name: `${selectedLostPet.petName ?? (selectedLostPet.markerType === "found"
                          ? tIndex("pet_found_label")
                          : tIndex("pet_lost_label"))} ${tIndex("photo_label", { number: index + 1 })}`,
                        isLoading: true,
                      })
                    }
                    onMouseLeave={() => setHoveredLostPetPhoto(null)}
                  />
                </div>
              ))}
            </div>
          </div>
        </aside>
      ) : null}

      {copyTooltip ? (
        <div
          className={`pointer-events-none fixed z-50 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white shadow-lg shadow-emerald-950/20 transition-all duration-300 ${
            copyTooltip.visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
          style={{ left: copyTooltip.x, top: copyTooltip.y }}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
            <path
              d="M16.25 5.5 8.5 13.25 3.75 8.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {tCommon("copied")}
        </div>
      ) : null}

      <section
        className={`absolute inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/90 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] transition-[height] duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-950/90 ${
          isPanelOpen ? "h-[calc(20vh+25px)]" : "h-14"
        }`}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-full left-0 z-30 mb-[-59px] w-72 transition-transform duration-700 ease-out ${
            isMonkeyVisible ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Lottie
            lottieRef={monkeyLottieRef}
            animationData={dancingMonkeyAnimation}
            loop={isMonkeyAnimating}
          />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 right-0 z-30 w-36"
          style={{
            opacity: isMonkeyVisible ? 1 : 0,
            transform: "translateX(9rem)",
            animation: isMonkeyVisible ? "turtle-roundtrip 32s linear infinite" : "none",
            transition: "opacity 300ms ease-out",
          }}
        >
          <Lottie animationData={turtleSkatingAnimation} loop />
        </div>
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -top-40 left-56 z-30 max-w-[520px] rounded-2xl border border-zinc-200 bg-white/95 px-4 py-3 text-xl text-zinc-700 shadow-lg transition-[transform,opacity] duration-700 ease-out dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200 ${
            isMonkeyVisible && monkeyDialogue
              ? "translate-x-0 opacity-100"
              : "-translate-x-full opacity-0"
          }`}
        >
          {monkeyDialogue}
        </div>
        {uploadProgress !== null ? (
          <div className="absolute inset-x-0 top-0 h-1 bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full bg-blue-600 transition-[width] duration-150 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        ) : null}

        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <Link
              href="/"
              scroll={false}
              className="text-blue-600 underline transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              onClick={(event) => {
                event.preventDefault();
                setIsPanelOpen(true);
                setActivePetForm(null);
                setPetLossId(null);
                setLostPetDate("");
                setLostPetName("");
                setHasSelectedLocation(false);
                setSelectedAddressDetail(null);
                setSelectedLostPet(null);
                setHoveredLostPetPhoto(null);
                lastSelectedAddressRef.current = null;
                setPhotoError("");
                setUploadError("");
                setSaveSuccessMessage("");
                clearThumbnailPreviews();
                updatePetFormSearchParam(null);
                if (hasTriggeredAddressGuideRef.current && !hasTriggeredInicioGuideRef.current) {
                  hasTriggeredInicioGuideRef.current = true;
                  runInicioGuide();
                }
              }}
            >
              {tIndex("home")}
            </Link>
            {activePetForm === "lost" ? <span>&gt; {tIndex("lost_pet")}</span> : null}
            {activePetForm === "found" ? <span>&gt; {tIndex("found_pet")}</span> : null}
          </div>
          <div className="relative flex items-center gap-2">
            <label htmlFor="language-search" className="sr-only">
              {tCommon("search_language")}
            </label>
            <input
              id="language-search"
              type="text"
              value={languageInputValue}
              onFocus={() => {
                setIsLanguageSearching(true);
                setLanguageQuery("");
                setIsLanguageMenuOpen(true);
              }}
              onChange={(event) => {
                setLanguageQuery(event.target.value);
                setIsLanguageMenuOpen(true);
              }}
              onBlur={() => {
                window.setTimeout(() => {
                  setIsLanguageMenuOpen(false);
                  if (!languageQuery.trim()) {
                    setIsLanguageSearching(false);
                  }
                }, 120);
              }}
              placeholder={tCommon("search_language")}
              className="h-9 w-48 rounded-full border border-zinc-200 bg-white/90 px-3 text-sm font-medium text-zinc-700 outline-none transition placeholder:text-zinc-400 hover:bg-zinc-100 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:hover:bg-zinc-800 dark:focus:border-zinc-500"
            />
            {isLanguageMenuOpen ? (
              <div className="absolute bottom-full right-0 z-40 mb-2 w-72 overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
                <div className="max-h-72 overflow-auto p-2">
                  {filteredLanguageOptions.length > 0 ? (
                    filteredLanguageOptions.map((language) => (
                      <button
                        key={language.value}
                        type="button"
                        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
                          selectedLanguage === language.value
                            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                            : "text-zinc-700 dark:text-zinc-200"
                        }`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setSelectedLanguage(language.value);
                          setLanguageQuery("");
                          setIsLanguageSearching(false);
                          setIsLanguageMenuOpen(false);
                          document.cookie = `locale=${encodeURIComponent(language.value)}; path=/; max-age=31536000`;
                          window.location.reload();
                        }}
                      >
                        <span className="text-base">{language.flag}</span>
                        <span className="truncate">{language.label}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {tCommon("no_results")}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              aria-label={tCommon("toggle_panel")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => setIsPanelOpen((current) => !current)}
            >
              {isPanelOpen ? (
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5">
                  <path
                    d="M5 12l5-5 5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5">
                  <path
                    d="M5 8l5 5 5-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {isPanelOpen ? (
          <div className="h-[calc(100%-3.5rem)] overflow-auto px-4 pb-4">
            {activePetForm !== null ? (
              <form className="flex w-full flex-col gap-4">
                <div className="flex w-full flex-nowrap items-start gap-6">
                  <div className="w-[360px] flex-none">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                    <label
                      htmlFor="lost-pet-date"
                      className="shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-200"
                    >
                      {activePetForm === "found" ? tCommon("date_found") : tCommon("date_lost")}
                    </label>
                    <input
                      id="lost-pet-date"
                      type="date"
                      value={lostPetDate}
                      onChange={(event) => setLostPetDate(event.target.value)}
                      className="w-[150px] max-w-[150px] flex-none rounded-xl border border-zinc-200 bg-white px-2 py-2 text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
                    />
                  </div>

                      <div className="flex items-center gap-3">
                        <label
                          htmlFor="lost-pet-name"
                          className="shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-200"
                        >
                          {activePetForm === "found" ? tCommon("name_optional") : tIndex("responds_to_name")}
                        </label>
                        <input
                          id="lost-pet-name"
                          type="text"
                          value={lostPetName}
                          maxLength={LOST_PET_NAME_MAX_LENGTH}
                          onChange={(event) =>
                            setLostPetName(
                              event.target.value.slice(0, LOST_PET_NAME_MAX_LENGTH),
                            )
                          }
                          placeholder={activePetForm === "found" ? tCommon("name_optional") : undefined}
                          className="w-[150px] max-w-[150px] flex-none rounded-xl border border-zinc-200 bg-white px-2 py-2 text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor="lost-pet-photos"
                        className="shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-200"
                      >
                        {tIndex("photos_label")}
                      </label>
                      <button
                        type="button"
                        className="flex-none cursor-pointer rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                        onClick={() => photoInputRef.current?.click()}
                      >
                        {tCommon("upload")}
                      </button>
                      <input
                        ref={photoInputRef}
                        id="lost-pet-photos"
                        type="file"
                        accept=".png,.jpg,.jpeg,.bmp,.gif,image/png,image/jpeg,image/bmp,image/gif"
                        multiple
                        onChange={handlePhotoChange}
                        className="sr-only"
                      />
                      <button
                        type="button"
                        disabled={!isSaveEnabled || isSaving}
                        className="ml-auto cursor-pointer rounded-xl border border-zinc-200 bg-white px-5 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:disabled:border-zinc-800 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                        onClick={handleSaveClick}
                      >
                        {isSaving ? tCommon("saving") : tCommon("save")}
                      </button>
                    </div>

                    <div className="flex min-w-0 items-center gap-2 overflow-x-auto rounded-lg px-1 py-1">
                      {uploadedThumbnailPreviews.map((preview) => (
                        <img
                          key={preview.id}
                          src={preview.thumbnailUrl}
                          alt={preview.name}
                          className="h-16 w-16 cursor-pointer flex-none rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
                          onMouseEnter={() =>
                            setHoveredPreview({
                              url: preview.originalUrl,
                              name: preview.name,
                            })
                          }
                          onMouseLeave={() => setHoveredPreview(null)}
                        />
                      ))}
                    </div>

                    {photoError ? (
                      <p className="text-sm text-red-600">{photoError}</p>
                    ) : null}
                  </div>
                </div>

              </form>
            ) : (
              <div className="grid h-full gap-3 md:grid-cols-2">
                {[
                  {
                    label: tIndex("lost_pet_button"),
                    onClick: handleLostPetClick,
                  },
                  {
                    label: tIndex("found_pet_button"),
                    onClick: handleFoundPetClick,
                  },
                ].map(({ label, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    className="flex min-h-24 cursor-pointer items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-center text-base font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                    onClick={onClick}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </section>

      {hoveredPreview ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="rounded-lg border border-zinc-300 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <img
              src={hoveredPreview.url}
              alt={hoveredPreview.name}
              className="h-[22rem] w-[22rem] rounded-md object-contain"
            />
          </div>
        </div>
      ) : hoveredLostPetPhoto ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="rounded-lg border border-zinc-300 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="relative flex min-h-[16rem] min-w-[16rem] items-center justify-center">
              {hoveredLostPetPhoto.isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-300 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-400" />
                </div>
              ) : null}
              <img
                src={hoveredLostPetPhoto.url}
                alt={hoveredLostPetPhoto.name}
                className={`max-h-[80vh] max-w-[80vw] rounded-md object-contain transition-opacity ${
                  hoveredLostPetPhoto.isLoading ? "opacity-0" : "opacity-100"
                }`}
                onLoad={() =>
                  setHoveredLostPetPhoto((current) =>
                    current ? { ...current, isLoading: false } : current,
                  )
                }
                onError={() => setHoveredLostPetPhoto(null)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {uploadError ? (
        <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,28rem)] rounded-xl border border-red-300 bg-red-100 p-4 text-red-900 shadow-xl">
          <p className="text-sm font-medium">{uploadError}</p>
          <button
            type="button"
            className="mt-3 rounded-md bg-red-200 px-3 py-1.5 text-sm font-medium text-red-900 transition hover:bg-red-300"
            onClick={() => setUploadError("")}
          >
            {tCommon("close")}
          </button>
        </div>
      ) : null}

      {saveSuccessMessage ? (
        <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,28rem)] rounded-xl border border-emerald-300 bg-emerald-100 p-4 text-emerald-900 shadow-xl">
          <p className="text-sm font-medium">{saveSuccessMessage}</p>
          <button
            type="button"
            className="mt-3 rounded-md bg-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-900 transition hover:bg-emerald-300"
            onClick={() => setSaveSuccessMessage("")}
          >
            {tCommon("close")}
          </button>
        </div>
      ) : null}
      <style jsx global>{`
        @keyframes turtle-roundtrip {
          0% {
            transform: translateX(9rem) scaleX(1);
          }
          49.999% {
            transform: translateX(calc(-100vw - 9rem)) scaleX(1);
          }
          50% {
            transform: translateX(calc(-100vw - 9rem)) scaleX(-1);
          }
          100% {
            transform: translateX(9rem) scaleX(-1);
          }
        }
      `}</style>
    </main>
  );
}
