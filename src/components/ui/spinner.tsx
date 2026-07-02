const sizes = { sm: "size-4", md: "size-6", lg: "size-8" } as const;

export function Spinner({ size = "md" }: { size?: keyof typeof sizes }) {
  return (
    <span
      data-slot="spinner"
      role="status"
      aria-label="Зарежда се"
      className={`${sizes[size]} inline-block animate-spin rounded-full border-2 border-current border-t-transparent`}
    />
  );
}
