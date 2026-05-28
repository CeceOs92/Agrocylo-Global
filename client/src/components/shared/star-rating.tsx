import { FaStar } from "react-icons/fa6";

interface StarRatingProps {
  rating: number;
  max?: number;
}

export function StarRating({ rating, max = 5 }: StarRatingProps) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <FaStar
          key={i}
          className={i < Math.round(rating) ? "text-[#FCCD29]" : "text-black/15"}
          size={14}
        />
      ))}
    </div>
  );
}
