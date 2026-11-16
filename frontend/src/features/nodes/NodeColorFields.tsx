import { ColorField } from "../../components/ColorField";

type NodeColorFieldsProps = {
  lineColor: string | null;
  cardColor: string | null;
  /** 線の色を Inherit にしたとき使われる色（親の枝の色） */
  inheritedLineColor: string;
  /** カードの色を Default にしたとき使われる色 */
  defaultCardColor: string;
  isRoot: boolean;
  onLineColorChange: (color: string | null) => void;
  onCardColorChange: (color: string | null) => void;
};

/**
 * M-04 の色の設定: カードの色（このアイデアだけ）と線の色（このアイデアへ入る線とその下の線すべて）。
 * どちらもカラーピッカーで自由に選べ、Default / Inherit で元に戻せる（manifests/nodes.md §3.5）。
 */
export function NodeColorFields({
  lineColor,
  cardColor,
  inheritedLineColor,
  defaultCardColor,
  isRoot,
  onLineColorChange,
  onCardColorChange,
}: NodeColorFieldsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="card-color" className="block text-sm font-medium text-slate-800">
          Card color
        </label>
        <p className="mb-2 text-xs text-slate-500">The color of this idea&apos;s card.</p>
        <ColorField
          id="card-color"
          value={cardColor}
          onChange={onCardColorChange}
          fallbackColor={defaultCardColor}
          fallbackLabel="Default"
        />
      </div>
      <div>
        <label htmlFor="line-color" className="block text-sm font-medium text-slate-800">
          Line color
        </label>
        <p className="mb-2 text-xs text-slate-500">
          {isRoot
            ? "Default color for every line in this tree."
            : "Used for the line into this idea and every line below it."}
        </p>
        <ColorField
          id="line-color"
          value={lineColor}
          onChange={onLineColorChange}
          fallbackColor={inheritedLineColor}
          fallbackLabel={isRoot ? "Default" : "Inherit"}
        />
      </div>
    </div>
  );
}
