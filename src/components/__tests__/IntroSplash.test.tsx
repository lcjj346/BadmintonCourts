import { act, render, screen } from "@testing-library/react";
import { IntroSplash } from "@/components/IntroSplash";

const STORAGE_KEY = "badmintonsg_intro_seen";

beforeEach(() => {
  sessionStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function matchMediaMock(reduceMotion: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") && reduceMotion,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("IntroSplash", () => {
  it("plays once on first visit, then removes itself and marks it seen", () => {
    matchMediaMock(false);
    render(<IntroSplash />);

    expect(screen.getByText("B")).toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();

    act(() => {
      jest.advanceTimersByTime(2350);
    });

    expect(screen.queryByText("B")).not.toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("does not render again once already seen this session", () => {
    matchMediaMock(false);
    sessionStorage.setItem(STORAGE_KEY, "1");
    render(<IntroSplash />);
    expect(screen.queryByText("B")).not.toBeInTheDocument();
  });

  it("skips entirely when the user prefers reduced motion", () => {
    matchMediaMock(true);
    render(<IntroSplash />);
    expect(screen.queryByText("B")).not.toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe("1");
  });
});
