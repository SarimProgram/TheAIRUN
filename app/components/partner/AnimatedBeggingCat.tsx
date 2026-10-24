import React, { useEffect } from 'react';
import { Image, ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { REMINDER_CAT_IMAGE } from '@/components/partner/reminderAssets';
import {
    DEFAULT_REMINDER_PHOTO_ANIMATION,
    type ReminderPhotoAnimation,
} from '@/components/partner/reminderPhotoAnimations';

const AnimatedImage = Animated.createAnimatedComponent(Image);

type AnimatedBeggingCatProps = {
    source?: ImageSourcePropType;
    style?: StyleProp<ImageStyle>;
    animation?: ReminderPhotoAnimation;
};

function useReminderPhotoMotion(animation: ReminderPhotoAnimation) {
    const sway = useSharedValue(0);
    const bounce = useSharedValue(0);
    const squash = useSharedValue(1);
    const slide = useSharedValue(0);
    const scale = useSharedValue(1);

    useEffect(() => {
        cancelAnimation(sway);
        cancelAnimation(bounce);
        cancelAnimation(squash);
        cancelAnimation(slide);
        cancelAnimation(scale);

        sway.value = 0;
        bounce.value = 0;
        squash.value = 1;
        slide.value = 0;
        scale.value = 1;

        switch (animation) {
            case 'beg':
                sway.value = withRepeat(
                    withSequence(
                        withTiming(-8, { duration: 420, easing: Easing.inOut(Easing.sin) }),
                        withTiming(8, { duration: 420, easing: Easing.inOut(Easing.sin) }),
                        withTiming(-5, { duration: 340, easing: Easing.inOut(Easing.sin) }),
                        withTiming(5, { duration: 340, easing: Easing.inOut(Easing.sin) }),
                        withTiming(0, { duration: 260, easing: Easing.inOut(Easing.sin) }),
                        withTiming(0, { duration: 180 }),
                    ),
                    -1,
                    false,
                );
                bounce.value = withRepeat(
                    withSequence(
                        withTiming(-6, { duration: 320, easing: Easing.inOut(Easing.quad) }),
                        withTiming(0, { duration: 320, easing: Easing.inOut(Easing.quad) }),
                        withTiming(0, { duration: 260 }),
                    ),
                    -1,
                    false,
                );
                squash.value = withRepeat(
                    withSequence(
                        withTiming(1.04, { duration: 320, easing: Easing.inOut(Easing.quad) }),
                        withTiming(0.96, { duration: 320, easing: Easing.inOut(Easing.quad) }),
                        withTiming(1, { duration: 280, easing: Easing.inOut(Easing.quad) }),
                        withTiming(1, { duration: 220 }),
                    ),
                    -1,
                    false,
                );
                break;

            case 'bounce':
                bounce.value = withRepeat(
                    withSequence(
                        withTiming(-18, { duration: 260, easing: Easing.out(Easing.quad) }),
                        withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }),
                        withTiming(-10, { duration: 220, easing: Easing.out(Easing.quad) }),
                        withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) }),
                        withTiming(0, { duration: 180 }),
                    ),
                    -1,
                    false,
                );
                scale.value = withRepeat(
                    withSequence(
                        withTiming(1.06, { duration: 260, easing: Easing.out(Easing.quad) }),
                        withTiming(0.98, { duration: 260, easing: Easing.in(Easing.quad) }),
                        withTiming(1, { duration: 420 }),
                    ),
                    -1,
                    false,
                );
                break;

            case 'wiggle':
                sway.value = withRepeat(
                    withSequence(
                        withTiming(-6, { duration: 90, easing: Easing.linear }),
                        withTiming(6, { duration: 90, easing: Easing.linear }),
                        withTiming(-4, { duration: 90, easing: Easing.linear }),
                        withTiming(4, { duration: 90, easing: Easing.linear }),
                        withTiming(0, { duration: 120, easing: Easing.out(Easing.quad) }),
                        withTiming(0, { duration: 240 }),
                    ),
                    -1,
                    false,
                );
                slide.value = withRepeat(
                    withSequence(
                        withTiming(-4, { duration: 90, easing: Easing.linear }),
                        withTiming(4, { duration: 90, easing: Easing.linear }),
                        withTiming(0, { duration: 120 }),
                        withTiming(0, { duration: 420 }),
                    ),
                    -1,
                    false,
                );
                break;

            case 'pulse':
                scale.value = withRepeat(
                    withSequence(
                        withTiming(1.12, { duration: 520, easing: Easing.inOut(Easing.sin) }),
                        withTiming(0.94, { duration: 520, easing: Easing.inOut(Easing.sin) }),
                        withTiming(1, { duration: 360, easing: Easing.inOut(Easing.sin) }),
                        withTiming(1, { duration: 200 }),
                    ),
                    -1,
                    false,
                );
                break;

            case 'float':
                bounce.value = withRepeat(
                    withSequence(
                        withTiming(-10, { duration: 900, easing: Easing.inOut(Easing.sin) }),
                        withTiming(4, { duration: 900, easing: Easing.inOut(Easing.sin) }),
                        withTiming(-10, { duration: 900, easing: Easing.inOut(Easing.sin) }),
                    ),
                    -1,
                    false,
                );
                sway.value = withRepeat(
                    withSequence(
                        withTiming(-3, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
                        withTiming(3, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
                    ),
                    -1,
                    false,
                );
                break;

            case 'sideToSide':
                slide.value = withRepeat(
                    withSequence(
                        withTiming(-14, { duration: 340, easing: Easing.inOut(Easing.quad) }),
                        withTiming(14, { duration: 340, easing: Easing.inOut(Easing.quad) }),
                        withTiming(-8, { duration: 280, easing: Easing.inOut(Easing.quad) }),
                        withTiming(8, { duration: 280, easing: Easing.inOut(Easing.quad) }),
                        withTiming(0, { duration: 220, easing: Easing.inOut(Easing.quad) }),
                        withTiming(0, { duration: 160 }),
                    ),
                    -1,
                    false,
                );
                break;

            case 'pop':
                scale.value = withRepeat(
                    withSequence(
                        withTiming(0.88, { duration: 120, easing: Easing.out(Easing.quad) }),
                        withTiming(1.14, { duration: 180, easing: Easing.out(Easing.back(2)) }),
                        withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) }),
                        withTiming(1, { duration: 520 }),
                    ),
                    -1,
                    false,
                );
                bounce.value = withRepeat(
                    withSequence(
                        withTiming(-8, { duration: 180, easing: Easing.out(Easing.quad) }),
                        withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) }),
                        withTiming(0, { duration: 640 }),
                    ),
                    -1,
                    false,
                );
                break;

            case 'tilt':
                sway.value = withRepeat(
                    withSequence(
                        withTiming(-10, { duration: 480, easing: Easing.inOut(Easing.sin) }),
                        withTiming(10, { duration: 480, easing: Easing.inOut(Easing.sin) }),
                        withTiming(-6, { duration: 360, easing: Easing.inOut(Easing.sin) }),
                        withTiming(6, { duration: 360, easing: Easing.inOut(Easing.sin) }),
                        withTiming(0, { duration: 280, easing: Easing.inOut(Easing.sin) }),
                        withTiming(0, { duration: 220 }),
                    ),
                    -1,
                    false,
                );
                scale.value = withRepeat(
                    withSequence(
                        withTiming(1.05, { duration: 480, easing: Easing.inOut(Easing.sin) }),
                        withTiming(0.97, { duration: 480, easing: Easing.inOut(Easing.sin) }),
                        withTiming(1, { duration: 640 }),
                    ),
                    -1,
                    false,
                );
                break;

            default:
                break;
        }

        return () => {
            cancelAnimation(sway);
            cancelAnimation(bounce);
            cancelAnimation(squash);
            cancelAnimation(slide);
            cancelAnimation(scale);
        };
    }, [animation, bounce, scale, slide, squash, sway]);

    const animatedStyle = useAnimatedStyle(() => {
        if (animation === 'beg') {
            return {
                transform: [
                    { translateY: bounce.value },
                    { rotate: `${sway.value}deg` },
                    { scaleX: squash.value },
                    { scaleY: 2 - squash.value },
                ],
            };
        }

        return {
            transform: [
                { translateX: slide.value },
                { translateY: bounce.value },
                { rotate: `${sway.value}deg` },
                { scale: scale.value },
            ],
        };
    });

    return animatedStyle;
}

export function AnimatedBeggingCat({
    source = REMINDER_CAT_IMAGE,
    style,
    animation = DEFAULT_REMINDER_PHOTO_ANIMATION,
}: AnimatedBeggingCatProps) {
    const animatedStyle = useReminderPhotoMotion(animation);

    return (
        <AnimatedImage
            source={source}
            style={[style, animatedStyle]}
            resizeMode="contain"
        />
    );
}
