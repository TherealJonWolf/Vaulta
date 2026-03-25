import { evaluatePasswordStrength } from "@/lib/passwordStrength";

interface Props {
  password: string;
}

const PasswordStrengthMeter = ({ password }: Props) => {
  if (!password) return null;

  const { score, label, color, feedback } = evaluatePasswordStrength(password);

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= score - 1 ? color : "bg-border"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted-foreground">
          Strength: <span className={score >= 3 ? "text-[#1D9E75]" : score >= 2 ? "text-yellow-500" : "text-[#E24B4A]"}>{label}</span>
        </span>
      </div>
      {feedback.length > 0 && (
        <ul className="space-y-0.5">
          {feedback.map((f) => (
            <li key={f} className="text-[10px] font-mono text-muted-foreground">
              • {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PasswordStrengthMeter;
