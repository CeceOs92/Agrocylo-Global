/**
 * Reusable UI components — shadcn/Radix primitives + a few in-house atoms.
 */

// shadcn primitives
export { Button, buttonVariants } from "./button";
export { Badge, badgeVariants } from "./badge";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "./card";
export { Input } from "./input";
export { Label } from "./label";
export { Textarea } from "./textarea";
export { Avatar, AvatarImage, AvatarFallback } from "./avatar";
export { Checkbox } from "./checkbox";
export { Switch } from "./switch";
export { Progress } from "./progress";
export { Separator } from "./separator";
export { Skeleton } from "./skeleton";
export {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";
export { Popover, PopoverContent, PopoverTrigger } from "./popover";
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";
export { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";
export { Toaster } from "./sonner";

// In-house atoms (no shadcn equivalent — kept for back-compat during the port)
export { Container } from "./Container";
export type { ContainerProps, ContainerSize } from "./Container";
export { Text } from "./Text";
export type { TextProps, TextVariant } from "./Text";
export { default as Spinner } from "./Spinner";
