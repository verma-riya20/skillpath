import * as React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * Skillpath — Courses section
 *
 * Fetches live course data + a country code from a deliberately flaky API
 * (~1/3 of requests 404/500 on both endpoints) and renders four states:
 * loading, error, empty, success.
 *
 * Design decisions worth knowing when someone asks "why is this written
 * this way":
 *  - fetchWithRetry does ONE retry. The API fails ~33% of the time, so a
 *    single retry drops the visible failure rate to roughly 1 in 9
 *    (0.33 * 0.33) without masking a genuinely dead endpoint forever.
 *  - If /country-code never resolves (even after retry), we don't block
 *    the whole section. We fall back to USD — an internationally legible
 *    default — and show a small, non-blocking note instead of guessing
 *    the user's currency.
 *  - We wait for BOTH course data and the country lookup to settle before
 *    rendering cards, so a price never flashes in one currency and then
 *    flips to another.
 *  - Columns (3/2/1) are driven by a ResizeObserver measuring THIS
 *    component's own rendered width, not CSS @media queries. Media
 *    queries respond to the browser window's viewport, which is wrong
 *    here: Framer's canvas can show multiple breakpoint frames inside
 *    one browser window, so a viewport-based query can't tell them
 *    apart. Measuring our own width works correctly both in Framer's
 *    editor and on real devices later.
 */

const BASE_URL = "https://syncsphere-hiv6.onrender.com"

type Course = {
    courseName: string
    courseCode: string
    description: string
    mainCategory: string
    shortCourse: string
    courseType: string
    pricePaise: number
    priceUsdCents: number
    mangoId: string
    refundable: boolean
}

type CountryCode = "IN" | "US"

async function fetchJson<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, { method: "GET" })
    if (!res.ok) {
        throw new Error(`GET ${path} failed with ${res.status}`)
    }
    return res.json()
}

async function fetchWithRetry<T>(path: string, retries = 1): Promise<T> {
    try {
        return await fetchJson<T>(path)
    } catch (err) {
        if (retries > 0) return fetchWithRetry<T>(path, retries - 1)
        throw err
    }
}

function formatPrice(course: Course, countryCode: CountryCode | null): string {
    // null countryCode = the API never resolved. Default to USD.
    const isIndia = countryCode === "IN"
    const amount = isIndia
        ? course.pricePaise / 100
        : course.priceUsdCents / 100
    return new Intl.NumberFormat(isIndia ? "en-IN" : "en-US", {
        style: "currency",
        currency: isIndia ? "INR" : "USD",
        maximumFractionDigits: 0,
    }).format(amount)
}

const EXTRA_FIELD_LABEL: Record<string, string> = {
    mainCategory: "Category",
    courseType: "Type",
    shortCourse: "Format",
}

type Props = {
    accentColor: string
    extraField: "mainCategory" | "courseType" | "shortCourse"
}

function useColumnCount(): [React.RefObject<HTMLDivElement>, number] {
    const ref = useRef<HTMLDivElement>(null)
    const [columns, setColumns] = useState(3)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        const computeColumns = (width: number) => {
            if (width < 640) return 1
            if (width < 900) return 2
            return 3
        }

        setColumns(computeColumns(el.offsetWidth))

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setColumns(computeColumns(entry.contentRect.width))
            }
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    return [ref, columns]
}

export default function SkillpathCourses(props: Props) {
    const { accentColor, extraField } = props
    const [containerRef, columns] = useColumnCount()

    const [courses, setCourses] = useState<Course[] | null>(null)
    const [coursesLoading, setCoursesLoading] = useState(true)
    const [coursesError, setCoursesError] = useState(false)

    const [countryCode, setCountryCode] = useState<CountryCode | null>(null)
    const [countryResolved, setCountryResolved] = useState(false)

    const loadCourses = useCallback(() => {
        setCoursesLoading(true)
        setCoursesError(false)
        fetchWithRetry<Course[]>("/assignment/course-data")
            .then((data) => {
                setCourses(data)
                setCoursesLoading(false)
            })
            .catch(() => {
                setCoursesError(true)
                setCoursesLoading(false)
            })
    }, [])

    const loadCountry = useCallback(() => {
        setCountryResolved(false)
        fetchWithRetry<{ country_code: CountryCode }>(
            "/assignment/country-code"
        )
            .then((res) => {
                setCountryCode(res.country_code)
                setCountryResolved(true)
            })
            .catch(() => {
                setCountryCode(null) // fallback handled in formatPrice
                setCountryResolved(true)
            })
    }, [])

    const retryAll = useCallback(() => {
        loadCourses()
        loadCountry()
    }, [loadCourses, loadCountry])

    useEffect(() => {
        loadCourses()
        loadCountry()
    }, [loadCourses, loadCountry])

    const isLoading = coursesLoading || !countryResolved
    const showCountryFallbackNote =
        countryResolved && countryCode === null && !coursesError

    return (
        <section className="sp-courses" ref={containerRef}>
            <style>{`
                .sp-courses {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 48px 24px;
                    font-family: -apple-system, "Inter", sans-serif;
                }
                .sp-courses__note {
                    font-size: 13px;
                    color: #888;
                    margin: 0 0 16px 0;
                }
                .sp-courses__grid {
                    display: grid;
                    gap: 20px;
                }
                .sp-card {
                    position: relative;
                    border: 1px solid #e6e6e6;
                    border-radius: 12px;
                    padding: 20px;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    background: #fff;
                }
                .sp-card__badge {
                    position: absolute;
                    top: 14px;
                    right: 14px;
                    font-size: 11px;
                    font-weight: 600;
                    padding: 3px 8px;
                    border-radius: 999px;
                    background: #eafaf0;
                    color: #1a8a4c;
                }
                .sp-card__name {
                    font-size: 17px;
                    font-weight: 600;
                    margin: 0;
                    padding-right: 70px;
                }
                .sp-card__desc {
                    font-size: 14px;
                    color: #666;
                    line-height: 1.4;
                    margin: 0;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .sp-card__meta {
                    font-size: 12px;
                    color: #999;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .sp-card__price {
                    font-size: 18px;
                    font-weight: 700;
                    margin-top: 4px;
                }
                .sp-skeleton {
                    background: linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 37%, #f0f0f0 63%);
                    background-size: 400% 100%;
                    animation: sp-shimmer 1.4s ease infinite;
                    min-height: 150px;
                }
                @keyframes sp-shimmer {
                    0% { background-position: 100% 50%; }
                    100% { background-position: 0 50%; }
                }
                .sp-state {
                    text-align: center;
                    padding: 40px 20px;
                    color: #666;
                }
                .sp-state button {
                    margin-top: 12px;
                    padding: 8px 18px;
                    border-radius: 8px;
                    border: 1px solid #ccc;
                    background: #fff;
                    cursor: pointer;
                    font-size: 14px;
                }
                .sp-state button:hover { background: #f5f5f5; }
            `}</style>

            {showCountryFallbackNote && (
                <p className="sp-courses__note">
                    Couldn't detect your region — showing prices in USD.
                </p>
            )}

            {isLoading && !coursesError && (
                <div
                    className="sp-courses__grid"
                    style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
                >
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div className="sp-card sp-skeleton" key={i} />
                    ))}
                </div>
            )}

            {!isLoading && coursesError && (
                <div className="sp-state">
                    <p>
                        Couldn't load courses right now. That's on our end, not
                        yours.
                    </p>
                    <button onClick={retryAll}>Retry</button>
                </div>
            )}

            {!isLoading && !coursesError && courses && courses.length === 0 && (
                <div className="sp-state">
                    <p>No courses live right now. Check back soon.</p>
                </div>
            )}

            {!isLoading && !coursesError && courses && courses.length > 0 && (
                <div
                    className="sp-courses__grid"
                    style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
                >
                    {courses.map((course) => (
                        <div className="sp-card" key={course.mangoId}>
                            {course.refundable && (
                                <span className="sp-card__badge">
                                    Refundable
                                </span>
                            )}
                            <h3 className="sp-card__name">
                                {course.courseName}
                            </h3>
                            <p className="sp-card__desc">
                                {course.description}
                            </p>
                            <div className="sp-card__meta">
                                {EXTRA_FIELD_LABEL[extraField]}:{" "}
                                {course[extraField]}
                            </div>
                            <div
                                className="sp-card__price"
                                style={{ color: accentColor }}
                            >
                                {formatPrice(course, countryCode)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}

SkillpathCourses.defaultProps = {
    accentColor: "#6C5CE7",
    extraField: "mainCategory",
}

addPropertyControls(SkillpathCourses, {
    accentColor: {
        type: ControlType.Color,
        title: "Accent Color",
        defaultValue: "#6C5CE7",
    },
    extraField: {
        type: ControlType.Enum,
        title: "Extra Field",
        options: ["mainCategory", "courseType", "shortCourse"],
        optionTitles: ["Category", "Type", "Format"],
        defaultValue: "mainCategory",
    },
})
