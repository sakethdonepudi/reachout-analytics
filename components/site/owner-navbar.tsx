"use client";
import NavCore, { type NavCoreProps } from "./nav-core";
export default function OwnerNavbar(props: Omit<NavCoreProps, "variant">) { return <NavCore variant="owner" {...props} />; }
