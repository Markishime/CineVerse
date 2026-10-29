// @vitest-environment jsdom
import React, { Suspense, act } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const state = vi.hoisted(() => ({
  profile: {
    uid: "viewer",
    username: "viewer",
    displayName: "Film fan",
    bio: "Original bio",
    stats: {},
    avatarUrl: null,
  },
  user: {
    uid: "viewer",
    photoURL: null,
    getIdToken: vi.fn().mockResolvedValue("token"),
  },
  setProfile: vi.fn(),
  loading: false,
}));
vi.mock("@/stores/auth-store", () => ({ useAuthStore: () => state }));
vi.mock("@/lib/api/user", () => ({
  fetchProfile: vi.fn(),
  fetchLibrary: vi.fn(),
  fetchFavorites: vi.fn(),
  updateMe: vi.fn(),
}));
vi.mock("@/lib/api/content", () => ({
  fetchContentById: vi.fn().mockResolvedValue(null),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) =>
    React.createElement("a", props, children),
}));
vi.mock("framer-motion", () => {
  const components = new Map();
  return {
    useReducedMotion: () => true,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy(
      {},
      {
        get: (_, tag: string) => {
          if (!components.has(tag))
            components.set(
              tag,
              ({
                children,
                variants,
                initial,
                animate,
                exit,
                transition,
                ...props
              }: Record<string, unknown>) => {
                void variants;
                void initial;
                void animate;
                void exit;
                void transition;
                return React.createElement(
                  tag,
                  props,
                  children as React.ReactNode,
                );
              },
            );
          return components.get(tag);
        },
      },
    ),
  };
});
import ProfilePage from "./page";
import { fetchLibrary, fetchFavorites, updateMe } from "@/lib/api/user";

const clients: QueryClient[] = [];
async function openProfile() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const params = Promise.resolve({ username: "me" });
  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <Suspense fallback="Loading">
          <ProfilePage params={params} />
        </Suspense>
      </QueryClientProvider>,
    );
  });
  await screen.findByRole("heading", { name: "Film fan" });
  return client;
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(fetchLibrary).mockResolvedValue({ items: [] });
  vi.mocked(fetchFavorites).mockResolvedValue({ items: [] });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

test("a failed profile save keeps the draft and reports the failure", async () => {
  vi.mocked(updateMe).mockRejectedValue(new Error("offline"));
  await openProfile();
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "New name" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "could not be saved",
  );
  expect(
    (screen.getByLabelText("Display name") as HTMLInputElement).value,
  ).toBe("New name");
  expect(state.setProfile).not.toHaveBeenCalled();
});

test("refreshing library data does not overwrite an unsaved bio", async () => {
  const client = await openProfile();
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText(/Bio/), {
    target: { value: "Draft bio" },
  });
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["library"] });
  });
  expect((screen.getByLabelText(/Bio/) as HTMLTextAreaElement).value).toBe(
    "Draft bio",
  );
});

test("dropped titles and library titles beyond the first page remain accessible", async () => {
  vi.mocked(fetchLibrary).mockResolvedValue({
    items: Array.from({ length: 17 }, (_, i) => ({
      id: `entry-${i}`,
      uid: "viewer",
      contentId: `title-${i}`,
      status: "dropped" as const,
      rating: null,
      progress: { episode: 0, season: 0, percent: 0 },
      notes: "",
      createdAt: "2026-10-01",
      updatedAt: "2026-10-01",
    })),
  });
  await openProfile();
  fireEvent.click(screen.getByRole("button", { name: /^Library/ }));
  await screen.findByRole("heading", { name: /Dropped/ });
  expect(screen.queryByRole("link", { name: "title-16" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
  expect(screen.getByRole("link", { name: "title-16" })).toBeTruthy();
});

test("failed favorites requests show a recoverable error instead of an empty collection", async () => {
  vi.mocked(fetchFavorites).mockRejectedValue(new Error("offline"));
  await openProfile();
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "could not be refreshed",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: /^Favorites/ }));
  expect(screen.queryByText("No favorites yet")).toBeNull();
  expect(
    screen.getByText("Favorites are temporarily unavailable."),
  ).toBeTruthy();
});
