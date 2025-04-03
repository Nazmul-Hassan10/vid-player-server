import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        // Step 1: Find the user by ID
        // Step 2: Generate access and refresh tokens
        // Step 3: Update the user's refresh token in memory
        // Step 4: Save the updated refresh token to the database
        // Step 5: Return the tokens

        const user = await User.findById(userId);

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;

        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };

        //
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generating refresh and access tokens"
        );
    }
};

const registerUser = asyncHandler(async (req, res) => {
    // res.status(200).json({
    //     message: "ok",
    // });

    /*

     1. get user details from frontend
     2. validation - not empty
     3. check if user already exists: username, email
     4. check for images, check for avatar
     5. upload them to cloudinary, avatar
     6. create user object - create entry in db
     7. remove password and refresh token field from response
     8. check for user creation
     9. return res

    */

    const { fullName, email, userName, password } = req.body;
    console.log(fullName, " ", email);
    console.log(req.body);

    if (
        [fullName, email, userName, password].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "FullName required");
    }

    const existedUser = await User.findOne({
        $or: [{ userName }, { email }],
    });

    if (existedUser) {
        throw new ApiError(
            409,
            "User with email or UserName already already exist"
        );
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path; (chaining condition something causes problem)

    let coverImageLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    console.log("✔ ", req);

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar Image required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar Image required");
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        userName,
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(
            500,
            "Something went wrong while registering the user"
        );
    }

    // return res.status(201).json({createdUser}) // (Can be sent like this, but we have a structured Response)
    return res.json(
        new ApiResponse(200, createdUser, "User Registered Successfully")
    );
});

const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    // userName email
    // find user if he exist
    // password check
    // access anf refresh token
    // send cookies

    const { email, userName, password } = req.body;

    if (!userName || !email) {
        throw new ApiError(400, "userName or email is required");
    }

    const user = await User.findOne({
        $or: [{ userName }, { email }],
    });

    if (!user) {
        throw new ApiError(404, "user doesn't exist 😡");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(404, "password incorrect 😡");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user._id
    );

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                "User logged in successfully"
            )
        );
});

/*----------------------------------------*/
const logoutUser = asyncHandler(async (req, res) => {
    //
});

export { registerUser, loginUser, logoutUser };
