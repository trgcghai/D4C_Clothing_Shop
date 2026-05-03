import { useEffect, useState } from "react"
import { ArrowUp } from "lucide-react" // Hoặc dùng icon khác nếu bạn muốn

export default function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false)

  // Lắng nghe scroll để hiện nút khi người dùng cuộn xuống
  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener("scroll", toggleVisibility)
    return () => window.removeEventListener("scroll", toggleVisibility)
  }, [])

  // Cuộn lên đầu
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    isVisible && (
      <button
        onClick={scrollToTop}
        className="fixed bottom-6 right-6 z-50 bg-black text-white p-3 rounded-full shadow-lg hover:bg-gray-800 transition"
        aria-label="Scroll to top"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    )
  )
}
