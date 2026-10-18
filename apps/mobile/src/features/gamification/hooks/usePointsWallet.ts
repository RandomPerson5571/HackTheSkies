import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "cibo.pointsWallet.v1";

type Wallet = {
  balance: number;
  earnedXp: number;
  purchases: string[];
};

const initialWallet = (): Wallet => ({ balance: 0, earnedXp: 0, purchases: [] });

function parseWallet(raw: unknown): Wallet {
  if (!raw || typeof raw !== "object") return initialWallet();
  const value = raw as Record<string, unknown>;
  return {
    balance:
      typeof value.balance === "number" && Number.isFinite(value.balance)
        ? Math.max(0, Math.floor(value.balance))
        : 0,
    earnedXp:
      typeof value.earnedXp === "number" && Number.isFinite(value.earnedXp)
        ? Math.max(0, Math.floor(value.earnedXp))
        : 0,
    purchases: Array.isArray(value.purchases)
      ? value.purchases.filter((id): id is string => typeof id === "string")
      : [],
  };
}

export function usePointsWallet(lifetimeXp: number) {
  const [wallet, setWallet] = useState<Wallet>(initialWallet);
  const [ready, setReady] = useState(false);
  const initialLifetimeXp = useRef(lifetimeXp);
  const walletRef = useRef(wallet);
  const readyRef = useRef(false);
  const purchaseLock = useRef(false);
  useEffect(() => {
    walletRef.current = wallet;
  }, [wallet]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(KEY)
      .then((raw) => {
        // Existing players start with their already earned XP as points.
        const stored = raw ? parseWallet(JSON.parse(raw)) : null;
        const next = stored ?? {
          balance: Math.max(0, Math.floor(initialLifetimeXp.current)),
          earnedXp: Math.max(0, Math.floor(initialLifetimeXp.current)),
          purchases: [],
        };
        if (!active) return;
        walletRef.current = next;
        setWallet(next);
        if (!stored) void AsyncStorage.setItem(KEY, JSON.stringify(next));
      })
      .catch(() => {
        if (active) {
          const next = {
            balance: Math.max(0, Math.floor(initialLifetimeXp.current)),
            earnedXp: Math.max(0, Math.floor(initialLifetimeXp.current)),
            purchases: [],
          };
          walletRef.current = next;
          setWallet(next);
        }
      })
      .finally(() => {
        if (active) {
          readyRef.current = true;
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const previous = walletRef.current;
    const totalEarned = Math.max(0, Math.floor(lifetimeXp));
    if (totalEarned <= previous.earnedXp) return;
    const next = {
      ...previous,
      balance: previous.balance + totalEarned - previous.earnedXp,
      earnedXp: totalEarned,
    };
    walletRef.current = next;
    setWallet(next);
    void AsyncStorage.setItem(KEY, JSON.stringify(next));
  }, [lifetimeXp, ready]);

  const purchase = useCallback(async (offerId: string, cost: number) => {
    if (!readyRef.current || purchaseLock.current) return "not-ready" as const;
    purchaseLock.current = true;
    const previous = walletRef.current;
    if (previous.purchases.includes(offerId)) {
      purchaseLock.current = false;
      return "already-purchased" as const;
    }
    if (previous.balance < cost) {
      purchaseLock.current = false;
      return "insufficient-points" as const;
    }
    const next = {
      ...previous,
      balance: previous.balance - cost,
      purchases: [...previous.purchases, offerId],
    };
    walletRef.current = next;
    setWallet(next);
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
      return "purchased" as const;
    } catch {
      walletRef.current = previous;
      setWallet(previous);
      return "save-failed" as const;
    } finally {
      purchaseLock.current = false;
    }
  }, []);

  return { balance: wallet.balance, purchases: wallet.purchases, ready, purchase };
}
