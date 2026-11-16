import { ColorField } from "../../components/ColorField";

/** カテゴリの既定の色（DB の既定値 #6B7280） */
export const DEFAULT_CATEGORY_COLOR = "#6B7280";

type ColorPickerProps = {
  id: string;
  value: string;
  onChange: (color: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/** カテゴリの色。カラーピッカーか #RRGGBB の入力で自由に選ぶ（manifests/nodes.md §3.5 Choosing colors） */
export function ColorPicker({ value, onChange, ...rest }: ColorPickerProps) {
  return (
    <ColorField
      {...rest}
      value={value}
      fallbackColor={DEFAULT_CATEGORY_COLOR}
      onChange={(color) => {
        onChange(color ?? DEFAULT_CATEGORY_COLOR);
      }}
    />
  );
}
