import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

export default withAuth(
  (req) => {
    if (!req.nextauth.token) {
      const signInUrl = new URL("/", req.nextUrl.origin);
      signInUrl.searchParams.set("next", req.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/",
    },
  },
);

export const config = {
  matcher: ["/dashboard/:path*"],
};
